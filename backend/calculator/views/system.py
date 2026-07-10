import os
import sys
import json
import shutil
import hashlib
import zipfile
import tempfile
import subprocess
import threading
import time
from pathlib import Path
from datetime import datetime, date, timedelta
import requests
from bs4 import BeautifulSoup
from rest_framework.decorators import api_view
from rest_framework.response import Response
from django.db import transaction as db_transaction

from calculator.models import Calculation, DailyLog, Wallet, Transaction
from calculator.auth import _check_auth, _get_secret_token
from calculator.utils import _get_data_dir, load_json, parse_version


@api_view(['GET'])
def get_bcv_rate(request):
    """
    Retrieves the BCV USD rate, caching it for 6 hours.
    Falls back to expired cache or fallback rate if BCV site is down/changed.
    """
    DATA_DIR = _get_data_dir()
    cache_path = DATA_DIR / 'bcv_rate_cache.json'
    
    # 1. Read existing cache
    cache_data = load_json(cache_path, None)
    now = datetime.now()
    
    # Try to use valid cache (less than 6 hours old)
    if cache_data:
        try:
            last_updated = datetime.fromisoformat(cache_data.get('last_updated', ''))
            if now - last_updated < timedelta(hours=6):
                return Response({
                    'rate': cache_data['rate'],
                    'cached': True,
                    'last_updated': cache_data['last_updated']
                })
        except Exception:
            pass

    # 2. Cache missing or expired, attempt scraping
    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    }
    
    scraped_rate = None
    scraping_error = None
    
    ssl_bypassed = False
    try:
        response = requests.get('https://www.bcv.org.ve/', headers=headers, verify=True, timeout=10)
    except requests.exceptions.SSLError:
        try:
            import urllib3
            urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)
            response = requests.get('https://www.bcv.org.ve/', headers=headers, verify=False, timeout=10)
            ssl_bypassed = True
        except Exception as e:
            scraping_error = str(e)
    except Exception as e:
        scraping_error = str(e)
        
    if not scraping_error:
        try:
            response.raise_for_status()
            soup = BeautifulSoup(response.content, 'html.parser')
            dolar_div = soup.find('div', id='dolar')
            if dolar_div:
                strong = dolar_div.find('strong')
                val_str = strong.text if strong else dolar_div.text
                scraped_rate = float(val_str.strip().replace(',', '.'))
            else:
                scraping_error = "Contenedor div#dolar no encontrado en el portal"
        except Exception as e:
            scraping_error = str(e)

    # 3. If scraping was successful, update cache and return
    if scraped_rate is not None and scraped_rate > 0:
        new_cache = {
            'rate': scraped_rate,
            'last_updated': now.isoformat()
        }
        if ssl_bypassed:
            new_cache['ssl_bypassed'] = True
        try:
            with open(cache_path, 'w', encoding='utf-8') as f:
                json.dump(new_cache, f, indent=2)
        except Exception:
            pass
        res_data = {
            'rate': scraped_rate,
            'cached': False,
            'last_updated': now.isoformat()
        }
        if ssl_bypassed:
            res_data['ssl_bypassed'] = True
            res_data['warning'] = 'Tasa obtenida omitiendo la verificacion SSL del portal BCV.'
        return Response(res_data)

    # 4. Scraping failed, apply contingencies
    if cache_data and 'rate' in cache_data:
        # Fallback to expired cache
        return Response({
            'rate': cache_data['rate'],
            'cached': True,
            'cached_fallback': True,
            'last_updated': cache_data['last_updated'],
            'warning': f'Portal BCV inalcanzable ({scraping_error}). Usando tasa guardada de contingencia.'
        })
        
    # Cold start contingency rate
    fallback_rate = 36.50
    return Response({
        'rate': fallback_rate,
        'cached': True,
        'cached_fallback': True,
        'fallback_contingency': True,
        'last_updated': now.isoformat(),
        'warning': f'Portal BCV inalcanzable ({scraping_error}) y sin cache previa. Usando tasa fija de contingencia ({fallback_rate}).'
    })


@api_view(['POST'])
def reset_database(request):
    """
    Deletes all records from Calculation, DailyLog, Wallet, and Transaction.
    """
    if not _check_auth(request):
        return Response({'error': 'Autenticacion requerida. Envie Authorization: Bearer <token>'}, status=401)
    
    try:
        with db_transaction.atomic():
            Transaction.objects.all().delete()
            Wallet.objects.all().delete()
            DailyLog.objects.all().delete()
            Calculation.objects.all().delete()
        return Response({'message': 'Base de datos restablecida con exito'})
    except Exception as e:
        return Response({'error': f'Error al restablecer la base de datos: {str(e)}'}, status=500)


@api_view(['GET'])
def check_update(request):
    def get_data_path():
        if getattr(sys, 'frozen', False):
            return Path(sys.executable).parent
        return Path(__file__).resolve().parent.parent.parent

    def get_base_path():
        if getattr(sys, 'frozen', False):
            return Path(sys._MEIPASS)
        return Path(__file__).resolve().parent.parent.parent.parent

    DATA_DIR = get_data_path()
    BASE_DIR = get_base_path()

    def load_update_state():
        state_path = DATA_DIR / 'update_state.json'
        state = load_json(state_path, {"last_check_date": "", "checks_today": 0})
        today = date.today().isoformat()
        if state.get("last_check_date") != today:
            state = {"last_check_date": today, "checks_today": 0}
            with open(state_path, 'w', encoding='utf-8') as f:
                json.dump(state, f, indent=2)
        return state

    local_version_file = load_json(DATA_DIR / 'version.json', None)
    if local_version_file is None:
        local_version_file = load_json(BASE_DIR / 'version.json', {})
    local_version = local_version_file.get('version', '0.0.0')

    config = load_json(BASE_DIR / 'release_config.json', {})
    owner = config.get('owner')
    repo = config.get('repo')

    if not owner or not repo:
        return Response({
            'update_available': False,
            'current_version': local_version,
            'latest_version': local_version,
            'download_url': None,
        })

    state = load_update_state()
    if state.get("checks_today", 0) >= 10:
        return Response({
            'update_available': False,
            'current_version': local_version,
            'latest_version': local_version,
            'download_url': None,
            'rate_limited': True,
        })

    url = f"https://api.github.com/repos/{owner}/{repo}/releases/latest"
    headers = {"Accept": "application/vnd.github.v3+json"}
    try:
        resp = requests.get(url, headers=headers, timeout=10)
        state["checks_today"] = state.get("checks_today", 0) + 1
        with open(DATA_DIR / 'update_state.json', 'w', encoding='utf-8') as f:
            json.dump(state, f, indent=2)

        if resp.status_code != 200:
            return Response({
                'update_available': False,
                'current_version': local_version,
                'latest_version': local_version,
                'download_url': None,
            })

        data = resp.json()
        tag = data.get("tag_name", "")
        assets = data.get("assets", [])
        
        # Detect active Python architecture/bitness
        import struct
        is_64bit = struct.calcsize("P") * 8 == 64
        arch_suffix = "_x64" if is_64bit else "_x86"
        expected_zip = f"P2P_Arbitrage{arch_suffix}.zip"

        download_url = None
        for asset in assets:
            if asset.get("name") == expected_zip:
                download_url = asset.get("browser_download_url")
                break

        if not download_url:
            # Fallback to the generic ZIP
            for asset in assets:
                if asset.get("name") == "P2P_Arbitrage.zip":
                    download_url = asset.get("browser_download_url")
                    break

        remote_ver = parse_version(tag)
        local_ver = parse_version(local_version)
        update_available = remote_ver > local_ver

        return Response({
            'update_available': update_available,
            'current_version': local_version,
            'latest_version': tag.lstrip('v'),
            'download_url': download_url,
            'release_url': f"https://github.com/{owner}/{repo}/releases/tag/{tag}",
        })
    except Exception:
        return Response({
            'update_available': False,
            'current_version': local_version,
            'latest_version': local_version,
            'download_url': None,
        })


@api_view(['POST'])
def apply_update(request):
    if not _check_auth(request):
        return Response({'error': 'Autenticacion requerida. Envie Authorization: Bearer <token>'}, status=401)

    def get_data_path():
        if getattr(sys, 'frozen', False):
            return Path(sys.executable).parent
        return Path(__file__).resolve().parent.parent.parent

    def get_base_path():
        if getattr(sys, 'frozen', False):
            return Path(sys._MEIPASS)
        return Path(__file__).resolve().parent.parent.parent.parent

    DATA_DIR = get_data_path()
    BASE_DIR = get_base_path()

    local_version_file = load_json(DATA_DIR / 'version.json', None)
    if local_version_file is None:
        local_version_file = load_json(BASE_DIR / 'version.json', {})
    local_version = local_version_file.get('version', '0.0.0')

    config = load_json(BASE_DIR / 'release_config.json', {})
    owner = config.get('owner')
    repo = config.get('repo')

    if not owner or not repo:
        return Response({'error': 'Configuracion de repositorio no encontrada'}, status=500)

    url = f"https://api.github.com/repos/{owner}/{repo}/releases/latest"
    headers = {"Accept": "application/vnd.github.v3+json"}
    try:
        resp = requests.get(url, headers=headers, timeout=10)
        if resp.status_code != 200:
            return Response({'error': 'No se pudo verificar actualizaciones'}, status=502)

        data = resp.json()
        tag = data.get("tag_name", "")
        assets = data.get("assets", [])
        # Detect active Python architecture/bitness
        import struct
        is_64bit = struct.calcsize("P") * 8 == 64
        arch_suffix = "_x64" if is_64bit else "_x86"
        expected_zip = f"P2P_Arbitrage{arch_suffix}.zip"

        download_url = None
        zip_name = ""
        for asset in assets:
            if asset.get("name") == expected_zip:
                download_url = asset.get("browser_download_url")
                zip_name = asset.get("name")
                break

        if not download_url:
            # Fallback to the generic ZIP
            for asset in assets:
                if asset.get("name") == "P2P_Arbitrage.zip":
                    download_url = asset.get("browser_download_url")
                    zip_name = asset.get("name")
                    break

        if not download_url:
            return Response({'error': 'No se encontro archivo ZIP en la release'}, status=502)

        # Hardening: Validate download_url domain
        if not (download_url.startswith("https://github.com/") or download_url.startswith("https://objects.githubusercontent.com/")):
            return Response({'error': 'URL de descarga no autorizada (dominio no confiable)'}, status=400)

        remote_ver = parse_version(tag)
        local_ver = parse_version(local_version)
        if remote_ver <= local_ver:
            return Response({'error': 'Ya tienes la ultima version'}, status=400)

    except Exception as e:
        return Response({'error': f'Error verificando actualizacion: {str(e)}'}, status=500)

    tmp_dir = Path(tempfile.mkdtemp(prefix="p2p_update_"))
    zip_path = tmp_dir / "update.zip"
    try:
        resp = requests.get(download_url, stream=True, timeout=120)
        resp.raise_for_status()
        with open(zip_path, 'wb') as f:
            for chunk in resp.iter_content(chunk_size=8192):
                f.write(chunk)
    except Exception as e:
        shutil.rmtree(tmp_dir, ignore_errors=True)
        return Response({'error': f'Error descargando: {str(e)}'}, status=502)

    # Cryptographic integrity validation via SHA-256 Checksum
    sha256_url = None
    expected_sha256_name = zip_name + ".sha256" if zip_name else ""
    for asset in assets:
        if asset.get("name") == expected_sha256_name:
            sha256_url = asset.get("browser_download_url")
            break

    if not sha256_url:
        shutil.rmtree(tmp_dir, ignore_errors=True)
        return Response({'error': f'Falta firma digital (.sha256) para el archivo {zip_name or "de actualizacion"}. Abortando por seguridad.'}, status=400)

    try:
        sha_resp = requests.get(sha256_url, timeout=10)
        sha_resp.raise_for_status()
        expected_hash = sha_resp.text.strip().split()[0].lower()
    except Exception as e:
        shutil.rmtree(tmp_dir, ignore_errors=True)
        return Response({'error': f'Error descargando firma digital de actualizacion: {str(e)}'}, status=502)

    sha256_hash = hashlib.sha256()
    try:
        with open(zip_path, "rb") as f:
            for byte_block in iter(lambda: f.read(4096), b""):
                sha256_hash.update(byte_block)
        calculated_hash = sha256_hash.hexdigest().lower()
    except Exception as e:
        shutil.rmtree(tmp_dir, ignore_errors=True)
        return Response({'error': f'Error calculando integridad del archivo: {str(e)}'}, status=500)

    if calculated_hash != expected_hash:
        shutil.rmtree(tmp_dir, ignore_errors=True)
        return Response({
            'error': f'Violacion de integridad. El hash calculado ({calculated_hash}) no coincide con el publicado ({expected_hash}). Abortando instalacion.'
        }, status=400)

    extract_dir = tmp_dir / "extracted"
    try:
        with zipfile.ZipFile(zip_path, 'r') as zf:
            zf.extractall(extract_dir)
    except zipfile.BadZipFile:
        shutil.rmtree(tmp_dir, ignore_errors=True)
        return Response({'error': 'Archivo ZIP corrupto'}, status=502)

    items = list(extract_dir.iterdir())
    source_dir = items[0] if len(items) == 1 and items[0].is_dir() else extract_dir

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
    $_.FullName -notlike "*auth_token.json*"
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
    updater_path = tmp_dir / "updater.ps1"
    with open(updater_path, 'w', encoding='utf-8') as f:
        f.write(ps_script)

    try:
        subprocess.Popen(
            ['powershell', '-ExecutionPolicy', 'Bypass', '-File', str(updater_path)],
            creationflags=getattr(subprocess, 'CREATE_NO_WINDOW', 0)
        )
    except Exception as e:
        shutil.rmtree(tmp_dir, ignore_errors=True)
        return Response({'error': f'Error lanzando actualizador: {str(e)}'}, status=500)

    def shutdown_server():
        time.sleep(2)
        sys.exit(0)

    threading.Thread(target=shutdown_server, daemon=True).start()

    return Response({
        'success': True,
        'message': f'Actualizando a {tag}... El servidor se reiniciara.',
        'new_version': tag.lstrip('v'),
    })


@api_view(['GET'])
def get_auth_token(request):
    """
    Returns the secret token. Only accessible from localhost and during development mode.
    Disallowed completely in production/portable bundle.
    """
    from django.conf import settings
    
    # Block in production (portable mode or DEBUG = False)
    if getattr(sys, 'frozen', False) or not settings.DEBUG:
        return Response({'error': 'Endpoint deshabilitado en produccion'}, status=403)
        
    remote_addr = request.META.get('REMOTE_ADDR', '')
    host_header = request.META.get('HTTP_HOST', '')
    valid_hosts = ('127.0.0.1', '::1', 'localhost')
    
    addr_ok = remote_addr in valid_hosts
    host_ok = any(h in host_header for h in valid_hosts) or host_header.startswith('localhost:')
    
    if not (addr_ok and host_ok):
        return Response({'error': 'Solo accesible desde localhost'}, status=403)
    token = _get_secret_token()
    return Response({'token': token})


@api_view(['GET'])
def get_version(request):
    """
    Returns the current app version from version.json.
    """
    data_dir = _get_data_dir()
    v = load_json(data_dir / 'version.json', None)
    if v is None:
        v = load_json(Path(__file__).resolve().parent.parent.parent.parent / 'version.json', {})
    return Response({'version': v.get('version', '0.0.0')})
