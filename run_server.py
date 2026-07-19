#!/usr/bin/env python
"""
P2P Arbitrage - Portable Server
"""
import os
import sys
import json
import shutil
import zipfile
import tempfile
import threading
import time
import webbrowser
from pathlib import Path
from datetime import date

if not getattr(sys, 'frozen', False):
    backend_path = Path(__file__).resolve().parent / 'backend'
    if str(backend_path) not in sys.path:
        sys.path.insert(0, str(backend_path))

from calculator.utils import load_json, parse_version, _get_data_dir, _get_project_root

BASE_DIR = _get_project_root()
DATA_DIR = _get_data_dir()

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'p2p_project.settings')

import django
from django.conf import settings
from django.core.wsgi import get_wsgi_application
from django.core.management import call_command
from waitress import serve

PORT = int(os.environ.get('P2P_PORT', 8000))
HOST = os.environ.get('P2P_HOST', '127.0.0.1')

settings.DATABASES['default']['NAME'] = str(DATA_DIR / 'db.sqlite3')
settings.STATIC_ROOT = str(BASE_DIR / 'staticfiles')
settings.DEBUG = False

env_hosts = os.environ.get('DJANGO_ALLOWED_HOSTS')
if env_hosts:
    settings.ALLOWED_HOSTS = [h.strip() for h in env_hosts.split(',') if h.strip()]
elif HOST == '0.0.0.0':
    print("  [ADVERTENCIA DE SEGURIDAD] DJANGO_ALLOWED_HOSTS no esta configurado.")
    print("  Habilitando '*' de forma temporal. Se recomienda configurar DJANGO_ALLOWED_HOSTS en produccion.")
    settings.ALLOWED_HOSTS = ['*']
else:
    settings.ALLOWED_HOSTS = [HOST, '127.0.0.1', 'localhost']

settings.CORS_ALLOWED_ORIGINS = []
settings.CORS_ALLOW_ALL_ORIGINS = False

django.setup()

# Generic schema repair: add any missing columns to existing tables
# This handles cases where migration state is recorded but columns were never created
try:
    import sqlite3 as _sqlite3
    from django.apps import apps as _apps

    _FIELD_SQL = {
        'AutoField': 'INTEGER',
        'BigAutoField': 'INTEGER',
        'CharField': 'VARCHAR({max_length})',
        'TextField': 'TEXT',
        'IntegerField': 'INTEGER',
        'BigIntegerField': 'INTEGER',
        'SmallIntegerField': 'INTEGER',
        'BooleanField': 'SMALLINT',
        'DecimalField': 'DECIMAL({max_digits},{decimal_places})',
        'FloatField': 'REAL',
        'DateField': 'DATE',
        'DateTimeField': 'DATETIME',
        'TimeField': 'TIME',
        'ForeignKey': 'INTEGER',
        'OneToOneField': 'INTEGER',
    }

    def _repair_table(conn, model):
        table = model._meta.db_table
        try:
            db_cols = {row[1] for row in conn.execute(f"PRAGMA table_info({table})").fetchall()}
        except Exception:
            return
        for field in model._meta.get_fields():
            if hasattr(field, 'column') and field.column not in db_cols:
                col_type = _FIELD_SQL.get(type(field).__name__, 'TEXT')
                if 'max_length' in col_type:
                    col_type = col_type.format(max_length=getattr(field, 'max_length', 255))
                if 'max_digits' in col_type:
                    col_type = col_type.format(
                        max_digits=getattr(field, 'max_digits', 10),
                        decimal_places=getattr(field, 'decimal_places', 2)
                    )
                nullable = 'NULL' if getattr(field, 'null', True) else 'NOT NULL'
                default = getattr(field, 'default', None)
                default_sql = ''
                if default is not None and not callable(default):
                    default_sql = f" DEFAULT {default}"
                elif getattr(field, 'null', True):
                    default_sql = ' DEFAULT NULL'
                try:
                    conn.execute(f"ALTER TABLE {table} ADD COLUMN {field.column} {col_type} {nullable}{default_sql}")
                except Exception:
                    pass
        conn.commit()

    _db_path = str(DATA_DIR / 'db.sqlite3')
    if Path(_db_path).exists():
        _conn = _sqlite3.connect(_db_path)
        for model in _apps.get_models():
            if model._meta.app_label == 'calculator':
                _repair_table(_conn, model)
        _conn.close()
except Exception:
    pass

# Always run migrate on startup to ensure database schema is up-to-date
try:
    call_command('migrate', verbosity=0)
except Exception:
    pass

django_app = get_wsgi_application()

# Determine frontend_dist directory dynamically
FRONTEND_DIST = Path(sys.executable).parent / 'frontend_dist' if getattr(sys, 'frozen', False) else Path(__file__).resolve().parent / 'frontend_dist'

if FRONTEND_DIST.exists():
    INDEX_FILE = FRONTEND_DIST / 'index.html'

    class SPAMiddleware:
        def __init__(self, app):
            self.app = app

        def __call__(self, environ, start_response):
            path = environ.get('PATH_INFO', '/')
            if path.startswith('/api/') or path.startswith('/admin/'):
                return self.app(environ, start_response)
            if path != '/':
                file_path = os.path.join(str(FRONTEND_DIST), path.lstrip('/'))
                if os.path.isfile(file_path):
                    import mimetypes
                    ct, _ = mimetypes.guess_type(file_path)
                    with open(file_path, 'rb') as f:
                        content = f.read()
                    start_response('200 OK', [('Content-Type', ct or 'application/octet-stream'), ('Content-Length', str(len(content)))])
                    return [content]
            if os.path.isfile(str(INDEX_FILE)):
                with open(str(INDEX_FILE), 'rb') as f:
                    content = f.read()
                try:
                    remote_addr = environ.get('REMOTE_ADDR', '')
                    if remote_addr in ('127.0.0.1', '::1', 'localhost'):
                        from calculator.auth import _get_secret_token
                        token = _get_secret_token()
                        html = content.decode('utf-8', errors='ignore')
                        injected_script = f'<script>window.__P2P_TOKEN__ = "{token}";</script></head>'
                        html = html.replace('</head>', injected_script, 1)
                        content = html.encode('utf-8')
                except Exception:
                    pass
                start_response('200 OK', [('Content-Type', 'text/html'), ('Content-Length', str(len(content)))])
                return [content]
            return self.app(environ, start_response)

    wsgi_app = SPAMiddleware(django_app)
else:
    wsgi_app = django_app

MAX_DAILY_CHECKS = 10

def save_json(path, data):
    with open(path, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=2)

def has_internet():
    import socket
    try:
        socket.create_connection(("1.1.1.1", 53), timeout=3)
        return True
    except (OSError, socket.timeout):
        return False

def get_local_version():
    v = load_json(DATA_DIR / 'version.json', None)
    if v is None:
        v = load_json(BASE_DIR / 'version.json', {})
    return v.get('version', '0.0.0')

def load_update_state():
    state_path = DATA_DIR / 'update_state.json'
    state = load_json(state_path, {"last_check_date": "", "checks_today": 0})
    today = date.today().isoformat()
    if state.get("last_check_date") != today:
        state = {"last_check_date": today, "checks_today": 0}
        save_json(state_path, state)
    return state

def increment_check_count(state):
    state["checks_today"] = state.get("checks_today", 0) + 1
    save_json(DATA_DIR / 'update_state.json', state)

def check_for_update():
    config = load_json(BASE_DIR / 'release_config.json', {})
    owner = config.get('owner')
    repo = config.get('repo')
    if not owner or not repo:
        return None

    state = load_update_state()
    if state["checks_today"] >= MAX_DAILY_CHECKS:
        return None

    import requests
    url = f"https://api.github.com/repos/{owner}/{repo}/releases/latest"
    headers = {"Accept": "application/vnd.github.v3+json"}
    try:
        resp = requests.get(url, headers=headers, timeout=10)
        increment_check_count(state)
        if resp.status_code != 200:
            return None
        data = resp.json()
        tag = data.get("tag_name", "")
        assets = data.get("assets", [])

        # Detect active Python architecture/bitness
        import struct
        is_64bit = struct.calcsize("P") * 8 == 64
        arch_suffix = "_x64" if is_64bit else "_x86"
        expected_zip = f"P2P_Arbitrage{arch_suffix}.zip"

        zip_url = None
        for asset in assets:
            if asset.get("name") == expected_zip:
                zip_url = asset.get("browser_download_url")
                break

        if not zip_url:
            # Fallback to the generic ZIP
            for asset in assets:
                if asset.get("name") == "P2P_Arbitrage.zip":
                    zip_url = asset.get("browser_download_url")
                    break

        return {"tag": tag, "zip_url": zip_url, "name": data.get("name", "")}
    except Exception:
        return None

def download_and_update(tag, zip_url):
    print(f"\n  Descargando {tag}...")
    tmp_dir = Path(tempfile.mkdtemp(prefix="p2p_update_"))
    zip_path = tmp_dir / "update.zip"

    import requests
    try:
        resp = requests.get(zip_url, stream=True, timeout=120)
        resp.raise_for_status()
        
        total_size = int(resp.headers.get('content-length', 0)) if hasattr(resp, 'headers') else 0
        MAX_UPDATE_SIZE = 100 * 1024 * 1024  # 100 MB limit
        if total_size > MAX_UPDATE_SIZE:
            raise Exception("El archivo de actualización excede el tamaño de descarga máximo permitido (100MB).")
            
        downloaded = 0
        with open(zip_path, 'wb') as f:
            for chunk in resp.iter_content(chunk_size=8192):
                downloaded += len(chunk)
                if downloaded > MAX_UPDATE_SIZE:
                    raise Exception("El tamaño de descarga excede el límite máximo permitido (100MB).")
                f.write(chunk)
    except Exception as e:
        print(f"  Error descargando: {e}")
        shutil.rmtree(tmp_dir, ignore_errors=True)
        return False

    extract_dir = tmp_dir / "extracted"
    try:
        with zipfile.ZipFile(zip_path, 'r') as zf:
            # Prevent Zip Slip / Path Traversal
            for member in zf.namelist():
                member_path = (extract_dir / member).resolve()
                if not str(member_path).startswith(str(extract_dir.resolve())):
                    raise Exception(f"Intento de Path Traversal detectado en el ZIP: {member}")
            zf.extractall(extract_dir)
    except Exception as e:
        print(f"  Error al descomprimir actualizacion: {e}")
        shutil.rmtree(tmp_dir, ignore_errors=True)
        return False

    items = list(extract_dir.iterdir())
    if len(items) == 1 and items[0].is_dir():
        source_dir = items[0]
    else:
        source_dir = extract_dir

    updater_ps1 = tmp_dir / "updater.ps1"
    app_dir = str(DATA_DIR).replace("'", "''")
    src_dir = str(source_dir).replace("'", "''")

    ps_script = f'''
$ErrorActionPreference = "Stop"
$appDir = '{app_dir}'
$srcDir = '{src_dir}'

Write-Host "Esperando cierre del proceso..."
$maxWait = 30
$waited = 0
while ($waited -lt $maxWait) {{
    $proc = Get-Process -Name "P2P_Arbitrage" -ErrorAction SilentlyContinue
    if (-not $proc) {{ break }}
    Start-Sleep -Seconds 1
    $waited++
}}

Write-Host "Reemplazando archivos..."
Get-ChildItem -Path $appDir -Recurse -File | Where-Object {{
    $_.FullName -notlike "*db.sqlite3*" -and
    $_.FullName -notlike "*update_state.json*" -and
    $_.FullName -notlike "*secret_key.json*" -and
    $_.FullName -notlike "*auth_token.json*" -and
    $_.FullName -notlike "*updater.ps1*"
}} | Remove-Item -Force -ErrorAction SilentlyContinue

Get-ChildItem -Path $srcDir -Recurse -File | ForEach-Object {{
    $rel = $_.FullName.Substring($srcDir.Length).TrimStart('\\')
    $dest = Join-Path $appDir $rel
    $destDir = Split-Path $dest -Parent
    if (-not (Test-Path $destDir)) {{ New-Item -ItemType Directory -Path $destDir -Force | Out-Null }}
    Copy-Item -Path $_.FullName -Destination $dest -Force
}}

Write-Host "Limpiando archivos temporales..."
Remove-Item -Path (Split-Path $srcDir) -Recurse -Force -ErrorAction SilentlyContinue

Write-Host "Iniciando P2P Arbitrage..."
Start-Process -FilePath (Join-Path $appDir "P2P_Arbitrage.exe")

Remove-Item -Path $PSCommandPath -Force -ErrorAction SilentlyContinue
'''
    with open(updater_ps1, 'w', encoding='utf-8') as f:
        f.write(ps_script)

    print("  Actualizacion lista. Reiniciando...")
    import subprocess
    subprocess.Popen(
        ['powershell', '-ExecutionPolicy', 'Bypass', '-File', str(updater_ps1)],
        creationflags=getattr(subprocess, 'CREATE_NO_WINDOW', 0)
    )
    return True

def open_browser():
    time.sleep(1.5)
    webbrowser.open(f'http://{HOST}:{PORT}')

def check_and_prompt_update():
    time.sleep(3)
    if not has_internet():
        return
    update_info = check_for_update()
    if not update_info:
        return
    tag = update_info["tag"]
    zip_url = update_info["zip_url"]
    local_ver = get_local_version()
    remote_ver = parse_version(tag)
    local_ver_t = parse_version(local_ver)
    if remote_ver > local_ver_t and zip_url:
        print(f"\n  *** Nueva version disponible: {tag} (actual: {local_ver}) ***")
        print(f"  Descargue manualmente desde: https://github.com/code-rmendoza/P2P-Arbitraje/releases")
        print()
    else:
        print(f"  [Update] Version actual: {local_ver} - Sin actualizaciones disponibles.")

def main():
    if getattr(sys, 'frozen', False):
        threading.Thread(target=check_and_prompt_update, daemon=True).start()

    if HOST != '0.0.0.0':
        threading.Thread(target=open_browser, daemon=True).start()
    try:
        serve(wsgi_app, host=HOST, port=PORT, threads=4)
    except KeyboardInterrupt:
        pass

if __name__ == '__main__':
    main()
