from rest_framework import viewsets, status
from rest_framework.decorators import api_view
from rest_framework.response import Response
from rest_framework.permissions import BasePermission
from django.utils import timezone
from django.db import transaction as db_transaction
from django.db.models import Q
from decimal import Decimal
from .models import Calculation, DailyLog, Wallet, Transaction
from .serializers import (
    CalculationSerializer, DailyLogSerializer, 
    WalletSerializer, TransactionSerializer
)
import os, sys, json
from pathlib import Path


def _get_data_dir():
    if getattr(sys, 'frozen', False):
        return Path(sys.executable).parent
    return Path(__file__).resolve().parent.parent.parent


def _get_secret_token():
    data_dir = _get_data_dir()
    token_file = data_dir / 'auth_token.json'
    try:
        with open(token_file, 'r') as f:
            data = json.load(f)
            return data.get('token', '')
    except (FileNotFoundError, json.JSONDecodeError):
        import secrets
        token = secrets.token_urlsafe(32)
        with open(token_file, 'w') as f:
            json.dump({'token': token}, f)
        return token


def _check_auth(request):
    auth_header = request.META.get('HTTP_AUTHORIZATION', '')
    if not auth_header.startswith('Bearer '):
        return False
    token = auth_header.split(' ', 1)[1]
    return token == _get_secret_token()


class RequireAuthForDestructive(BasePermission):
    """Allow read + create without auth. Require auth for update/delete."""
    def has_permission(self, request, view):
        if request.method in ('GET', 'HEAD', 'OPTIONS', 'POST'):
            return True
        return _check_auth(request)


def compute_p2p_math(capital, tasa_venta, tasa_compra, ciclos_dia, 
                     tipo_operativa='USD',
                     comision_compra=0.35, comision_venta=0.35):
    # DUPLICATED: Also implemented in frontend/src/api.ts:performLocalCalculations
    # Keep both in sync if changing formulas. Frontend copy enables offline mode.
    K = float(capital)
    Cb = float(comision_compra) / 100.0
    Cs = float(comision_venta) / 100.0
    S = float(tasa_venta)
    B = float(tasa_compra)
    cycles = int(ciclos_dia)
    
    multiplier = (S / B) * (1.0 - Cb) * (1.0 - Cs)
    
    monto_venta = K * S * (1.0 - Cs)
    monto_compra = monto_venta * (1.0 - Cb) / B
    final_capital = monto_compra
        
    ganancia_ciclo = final_capital - K
    ganancia_porcentaje = (multiplier - 1.0) * 100.0
    ganancia_diaria = ganancia_ciclo * cycles
    ganancia_mensual = ganancia_diaria * 30.0
    
    tasa_minima_compra = S * (1.0 - Cb) * (1.0 - Cs)
    
    return {
        'monto_venta': round(monto_venta, 2),
        'monto_compra': round(monto_compra, 2),
        'ganancia_porcentaje': round(ganancia_porcentaje, 4),
        'ganancia_ciclo': round(ganancia_ciclo, 2),
        'ganancia_diaria': round(ganancia_diaria, 2),
        'ganancia_mensual': round(ganancia_mensual, 2),
        'tasa_minima_compra': round(tasa_minima_compra, 3),
    }


@api_view(['POST'])
def calculate_p2p(request):
    capital = request.data.get('capital')
    tasa_venta = request.data.get('tasa_venta')
    tasa_compra = request.data.get('tasa_compra')
    ciclos_dia = request.data.get('ciclos_dia', 1)
    tipo_operativa = request.data.get('tipo_operativa', 'USD')
    comision_compra = request.data.get('comision_compra', 0.35)
    comision_venta = request.data.get('comision_venta', 0.35)

    # Validate required fields present
    if None in [capital, tasa_venta, tasa_compra]:
        return Response(
            {"error": "Campos obligatorios faltantes (capital, tasa_venta, tasa_compra)"},
            status=status.HTTP_400_BAD_REQUEST
        )

    # Validate types are numeric
    try:
        capital = float(capital)
        tasa_venta = float(tasa_venta)
        tasa_compra = float(tasa_compra)
        ciclos_dia = int(ciclos_dia)
        comision_compra = float(comision_compra)
        comision_venta = float(comision_venta)
    except (TypeError, ValueError):
        return Response(
            {"error": "Todos los valores numericos deben ser numeros validos"},
            status=status.HTTP_400_BAD_REQUEST
        )

    # Validate ranges
    errors = []
    if capital <= 0:
        errors.append("capital debe ser mayor a 0")
    if tasa_venta <= 0:
        errors.append("tasa_venta debe ser mayor a 0")
    if tasa_compra <= 0:
        errors.append("tasa_compra debe ser mayor a 0")
    if ciclos_dia <= 0:
        errors.append("ciclos_dia debe ser mayor a 0")
    if not (0 <= comision_compra <= 100):
        errors.append("comision_compra debe estar entre 0 y 100")
    if not (0 <= comision_venta <= 100):
        errors.append("comision_venta debe estar entre 0 y 100")
    if errors:
        return Response({"error": "; ".join(errors)}, status=status.HTTP_400_BAD_REQUEST)

    try:
        results = compute_p2p_math(
            capital=capital, tasa_venta=tasa_venta, tasa_compra=tasa_compra,
            ciclos_dia=ciclos_dia, tipo_operativa=tipo_operativa,
            comision_compra=comision_compra,
            comision_venta=comision_venta
        )
        return Response(results, status=status.HTTP_200_OK)
    except ZeroDivisionError:
        return Response(
            {"error": "tasa_compra no puede ser cero"},
            status=status.HTTP_400_BAD_REQUEST
        )
    except Exception as e:
        return Response(
            {"error": "Error en el calculo"},
            status=status.HTTP_400_BAD_REQUEST
        )


class CalculationViewSet(viewsets.ModelViewSet):
    queryset = Calculation.objects.all()
    serializer_class = CalculationSerializer
    permission_classes = [RequireAuthForDestructive]
    
    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        
        metrics = compute_p2p_math(
            capital=data['capital'], tasa_venta=data['tasa_venta'],
            tasa_compra=data['tasa_compra'], ciclos_dia=data.get('ciclos_dia', 1),
            tipo_operativa=request.data.get('tipo_operativa', 'USD'),
            comision_compra=float(request.data.get('comision_compra', 0.35)),
            comision_venta=float(request.data.get('comision_venta', 0.35))
        )
        
        instance = Calculation.objects.create(
            label=request.data.get('label', 'Nueva Simulación'),
            capital=data['capital'],
            tipo_operativa=request.data.get('tipo_operativa', 'USD'),
            plataforma_compra=request.data.get('plataforma_compra', ''),
            plataforma_venta=request.data.get('plataforma_venta', ''),
            comision_compra=float(request.data.get('comision_compra', 0.35)),
            comision_venta=float(request.data.get('comision_venta', 0.35)),
            metodo_compra=request.data.get('metodo_compra', ''),
            metodo_venta=request.data.get('metodo_venta', ''),
            tasa_venta=data['tasa_venta'],
            tasa_compra=data['tasa_compra'],
            tasa_retorno=1.0,
            ciclos_dia=data.get('ciclos_dia', 1),
            metodos_pago=data.get('metodos_pago', 1),
            **metrics
        )
        
        response_serializer = self.get_serializer(instance)
        return Response(response_serializer.data, status=status.HTTP_201_CREATED)


class DailyLogViewSet(viewsets.ModelViewSet):
    queryset = DailyLog.objects.all()
    serializer_class = DailyLogSerializer
    permission_classes = [RequireAuthForDestructive]


class WalletViewSet(viewsets.ModelViewSet):
    queryset = Wallet.objects.all()
    serializer_class = WalletSerializer
    permission_classes = [RequireAuthForDestructive]


class TransactionViewSet(viewsets.ModelViewSet):
    queryset = Transaction.objects.all()
    serializer_class = TransactionSerializer
    permission_classes = [RequireAuthForDestructive]

    def get_queryset(self):
        queryset = Transaction.objects.select_related('wallet_from', 'wallet_to').all()
        wallet_id = self.request.query_params.get('wallet')
        start_date = self.request.query_params.get('start_date')
        end_date = self.request.query_params.get('end_date')

        if wallet_id:
            queryset = queryset.filter(
                Q(wallet_from_id=wallet_id) |
                Q(wallet_to_id=wallet_id)
            )
        if start_date:
            queryset = queryset.filter(date__date__gte=start_date)
        if end_date:
            queryset = queryset.filter(date__date__lte=end_date)

        return queryset

    def create(self, request, *args, **kwargs):
        """
        Create a transaction and atomically update wallet balances.
        - wallet_from: balance decreases by amount_out
        - wallet_to: balance increases by amount_in
        Validates sufficient funds in wallet_from.
        """
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        
        wallet_from = data.get('wallet_from')
        wallet_to = data.get('wallet_to')
        amount_out = Decimal(str(data.get('amount_out', 0)))
        amount_in = Decimal(str(data.get('amount_in', 0)))
        tx_type = data.get('type')

        # Validate: at least one wallet must be involved
        if not wallet_from and not wallet_to:
            return Response(
                {"error": "Debes seleccionar al menos una billetera (origen o destino)."},
                status=status.HTTP_400_BAD_REQUEST
            )
        if wallet_from and wallet_to and wallet_from.id == wallet_to.id:
            return Response(
                {"error": "La billetera origen y destino deben ser diferentes."},
                status=status.HTTP_400_BAD_REQUEST
            )
        if amount_out < 0 or amount_in < 0:
            return Response(
                {"error": "Los montos no pueden ser negativos."},
                status=status.HTTP_400_BAD_REQUEST
            )
        if wallet_from and amount_out <= 0:
            return Response(
                {"error": "El monto de salida debe ser mayor a cero cuando hay billetera origen."},
                status=status.HTTP_400_BAD_REQUEST
            )
        if wallet_to and amount_in <= 0:
            return Response(
                {"error": "El monto de entrada debe ser mayor a cero cuando hay billetera destino."},
                status=status.HTTP_400_BAD_REQUEST
            )
        if tx_type == 'DEPOSITO' and wallet_from:
            return Response(
                {"error": "Un depósito debe tener origen externo, sin billetera origen."},
                status=status.HTTP_400_BAD_REQUEST
            )
        if tx_type == 'RETIRO' and wallet_to:
            return Response(
                {"error": "Un retiro debe tener destino externo, sin billetera destino."},
                status=status.HTTP_400_BAD_REQUEST
            )
        if tx_type in ['VENTA_P2P', 'COMPRA_P2P', 'TRANSFERENCIA'] and (not wallet_from or not wallet_to):
            return Response(
                {"error": "Las operaciones P2P y transferencias requieren billetera origen y destino."},
                status=status.HTTP_400_BAD_REQUEST
            )

        with db_transaction.atomic():
            if wallet_from:
                wallet_from = Wallet.objects.select_for_update().get(pk=wallet_from.pk)
            if wallet_to:
                wallet_to = Wallet.objects.select_for_update().get(pk=wallet_to.pk)

            if wallet_from and wallet_from.balance < amount_out:
                return Response(
                    {"error": f"Saldo insuficiente en '{wallet_from.name}'. "
                              f"Disponible: {wallet_from.balance:.2f} {wallet_from.currency}, "
                              f"requerido: {amount_out:.2f} {wallet_from.currency}."},
                    status=status.HTTP_400_BAD_REQUEST
                )

            serializer.validated_data['wallet_from'] = wallet_from
            serializer.validated_data['wallet_to'] = wallet_to
            if not serializer.validated_data.get('date'):
                serializer.validated_data['date'] = timezone.now()
            instance = serializer.save()
            
            if wallet_from:
                wallet_from.balance -= amount_out
                wallet_from.save(update_fields=['balance'])
            
            if wallet_to:
                wallet_to.balance += amount_in
                wallet_to.save(update_fields=['balance'])

        # Re-serialize with nested wallet names
        response_serializer = self.get_serializer(instance)
        return Response(response_serializer.data, status=status.HTTP_201_CREATED)

    def update(self, request, *args, **kwargs):
        return Response(
            {"error": "No se permite editar transacciones aplicadas. Elimina y vuelve a registrar el movimiento."},
            status=status.HTTP_405_METHOD_NOT_ALLOWED
        )

    def partial_update(self, request, *args, **kwargs):
        return self.update(request, *args, **kwargs)

    def destroy(self, request, *args, **kwargs):
        """
        Reverse the balance changes when deleting a transaction.
        """
        instance = self.get_object()
        
        with db_transaction.atomic():
            # Reverse: add back to origin, subtract from destination
            if instance.wallet_from and instance.amount_out > 0:
                instance.wallet_from.balance += instance.amount_out
                instance.wallet_from.save()
            
            if instance.wallet_to and instance.amount_in > 0:
                instance.wallet_to.balance -= instance.amount_in
                instance.wallet_to.save()
            
            instance.delete()
        
        return Response(status=status.HTTP_204_NO_CONTENT)


@api_view(['GET'])
def get_bcv_rate(request):
    """
    Scrapes the official BCV website for the USD rate.
    Tries SSL verification first; falls back to unverified if BCV cert fails.
    """
    import requests
    from bs4 import BeautifulSoup
    
    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    }
    try:
        response = requests.get('https://www.bcv.org.ve/', headers=headers, verify=True, timeout=15)
    except requests.exceptions.SSLError:
        import urllib3
        urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)
        response = requests.get('https://www.bcv.org.ve/', headers=headers, verify=False, timeout=15)
    try:
        response.raise_for_status()
        soup = BeautifulSoup(response.content, 'html.parser')
        dolar_div = soup.find('div', id='dolar')
        if dolar_div:
            strong = dolar_div.find('strong')
            val_str = strong.text if strong else dolar_div.text
            rate = float(val_str.strip().replace(',', '.'))
            return Response({'rate': rate})
        return Response({'error': 'No se encontró el contenedor de la tasa en el portal de BCV'}, status=500)
    except Exception as e:
        return Response({'error': f'Error al consultar el portal del BCV: {str(e)}'}, status=500)


@api_view(['POST'])
def reset_database(request):
    """
    Deletes all records from Calculation, DailyLog, Wallet, and Transaction.
    """
    if not _check_auth(request):
        return Response({'error': 'Autenticacion requerida. Envie Authorization: Bearer <token>'}, status=401)
    from .models import Calculation, DailyLog, Wallet, Transaction
    try:
        Calculation.objects.all().delete()
        DailyLog.objects.all().delete()
        Wallet.objects.all().delete()
        Transaction.objects.all().delete()
        return Response({'message': 'Base de datos restablecida con exito'})
    except Exception as e:
        return Response({'error': f'Error al restablecer la base de datos: {str(e)}'}, status=500)


@api_view(['GET'])
def check_update(request):
    import os, sys, json
    from pathlib import Path
    from datetime import date

    def get_data_path():
        if getattr(sys, 'frozen', False):
            return Path(sys.executable).parent
        return Path(__file__).resolve().parent.parent.parent

    def get_base_path():
        if getattr(sys, 'frozen', False):
            return Path(sys._MEIPASS)
        return Path(__file__).resolve().parent.parent.parent

    DATA_DIR = get_data_path()
    BASE_DIR = get_base_path()

    def load_json(path, default=None):
        try:
            with open(path, 'r', encoding='utf-8') as f:
                return json.load(f)
        except (FileNotFoundError, json.JSONDecodeError):
            return default

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

    import requests
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
        download_url = None
        for asset in assets:
            if asset.get("name", "").endswith(".zip"):
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
    import os, sys, json, shutil, zipfile, tempfile, subprocess
    from pathlib import Path

    if not _check_auth(request):
        return Response({'error': 'Autenticacion requerida. Envie Authorization: Bearer <token>'}, status=401)

    def get_data_path():
        if getattr(sys, 'frozen', False):
            return Path(sys.executable).parent
        return Path(__file__).resolve().parent.parent.parent

    def get_base_path():
        if getattr(sys, 'frozen', False):
            return Path(sys._MEIPASS)
        return Path(__file__).resolve().parent.parent.parent

    DATA_DIR = get_data_path()
    BASE_DIR = get_base_path()

    def load_json(path, default=None):
        try:
            with open(path, 'r', encoding='utf-8') as f:
                return json.load(f)
        except (FileNotFoundError, json.JSONDecodeError):
            return default

    def parse_version(v):
        try:
            parts = v.strip().lstrip('v').split('.')
            return tuple(int(x) for x in parts)
        except (ValueError, AttributeError):
            return (0, 0, 0)

    local_version_file = load_json(DATA_DIR / 'version.json', None)
    if local_version_file is None:
        local_version_file = load_json(BASE_DIR / 'version.json', {})
    local_version = local_version_file.get('version', '0.0.0')

    config = load_json(BASE_DIR / 'release_config.json', {})
    owner = config.get('owner')
    repo = config.get('repo')

    if not owner or not repo:
        return Response({'error': 'Configuracion de repositorio no encontrada'}, status=500)

    import requests
    url = f"https://api.github.com/repos/{owner}/{repo}/releases/latest"
    headers = {"Accept": "application/vnd.github.v3+json"}
    try:
        resp = requests.get(url, headers=headers, timeout=10)
        if resp.status_code != 200:
            return Response({'error': 'No se pudo verificar actualizaciones'}, status=502)

        data = resp.json()
        tag = data.get("tag_name", "")
        assets = data.get("assets", [])
        download_url = None
        for asset in assets:
            if asset.get("name", "").endswith(".zip"):
                download_url = asset.get("browser_download_url")
                break

        if not download_url:
            return Response({'error': 'No se encontro archivo ZIP en la release'}, status=502)

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

    import threading
    def shutdown_server():
        import time
        time.sleep(2)
        import sys
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
    Returns the secret token. Only accessible from localhost.
    Validates both REMOTE_ADDR and Host header.
    """
    remote_addr = request.META.get('REMOTE_ADDR', '')
    host_header = request.META.get('HTTP_HOST', '')
    valid_hosts = ('127.0.0.1', '::1', 'localhost')
    
    addr_ok = remote_addr in valid_hosts
    host_ok = any(h in host_header for h in valid_hosts) or host_header.startswith('localhost:')
    
    if not (addr_ok and host_ok):
        return Response({'error': 'Solo accesible desde localhost'}, status=403)
    token = _get_secret_token()
    return Response({'token': token})
