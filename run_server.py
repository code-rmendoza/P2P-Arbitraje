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

def get_base_path():
    if getattr(sys, 'frozen', False):
        return Path(sys._MEIPASS)
    return Path(__file__).resolve().parent

def get_data_path():
    if getattr(sys, 'frozen', False):
        return Path(sys.executable).parent
    return Path(__file__).resolve().parent

BASE_DIR = get_base_path()
DATA_DIR = get_data_path()

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'p2p_project.settings')

import django
from django.conf import settings
from django.core.wsgi import get_wsgi_application
from django.core.management import call_command
from waitress import serve

settings.DATABASES['default']['NAME'] = str(DATA_DIR / 'db.sqlite3')
settings.STATIC_ROOT = str(BASE_DIR / 'staticfiles')
settings.DEBUG = False
settings.ALLOWED_HOSTS = ['*']
settings.CORS_ALLOWED_ORIGINS = []
settings.CORS_ALLOW_ALL_ORIGINS = False

django.setup()

db_path = DATA_DIR / 'db.sqlite3'
if not db_path.exists():
    call_command('migrate', '--run-syncdb', verbosity=0)

django_app = get_wsgi_application()

if getattr(sys, 'frozen', False):
    FRONTEND_DIST = Path(sys.executable).parent / 'frontend_dist'
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
                start_response('200 OK', [('Content-Type', 'text/html'), ('Content-Length', str(len(content)))])
                return [content]
            return self.app(environ, start_response)

    wsgi_app = SPAMiddleware(django_app)
else:
    wsgi_app = django_app

PORT = int(os.environ.get('P2P_PORT', 8000))
HOST = '127.0.0.1'

MAX_DAILY_CHECKS = 10

def load_json(path, default=None):
    try:
        with open(path, 'r', encoding='utf-8') as f:
            return json.load(f)
    except (FileNotFoundError, json.JSONDecodeError):
        return default

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

def parse_version(v):
    try:
        parts = v.strip().lstrip('v').split('.')
        return tuple(int(x) for x in parts)
    except (ValueError, AttributeError):
        return (0, 0, 0)

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
        zip_url = None
        for asset in assets:
            name = asset.get("name", "")
            if name.endswith(".zip"):
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
        with open(zip_path, 'wb') as f:
            for chunk in resp.iter_content(chunk_size=8192):
                f.write(chunk)
    except Exception as e:
        print(f"  Error descargando: {e}")
        shutil.rmtree(tmp_dir, ignore_errors=True)
        return False

    extract_dir = tmp_dir / "extracted"
    try:
        with zipfile.ZipFile(zip_path, 'r') as zf:
            zf.extractall(extract_dir)
    except zipfile.BadZipFile:
        print("  Error: archivo ZIP corrupto")
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
    $rel = $_.FullName.Substring($srcDir.Length)
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

    threading.Thread(target=open_browser, daemon=True).start()
    try:
        serve(wsgi_app, host=HOST, port=PORT, threads=4)
    except KeyboardInterrupt:
        pass

if __name__ == '__main__':
    main()
