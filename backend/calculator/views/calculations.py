from rest_framework import viewsets, status
from rest_framework.decorators import api_view
from rest_framework.response import Response

from calculator.models import Calculation
from calculator.serializers import CalculationSerializer
from calculator.auth import RequireAuthForDestructive


from decimal import Decimal

def compute_p2p_math(capital, tasa_venta, tasa_compra, ciclos_dia, 
                     tipo_operativa='USD',
                     comision_compra=0.35, comision_venta=0.35):
    K = Decimal(str(capital))
    Cb = Decimal(str(comision_compra)) / Decimal('100.0')
    Cs = Decimal(str(comision_venta)) / Decimal('100.0')
    S = Decimal(str(tasa_venta))
    B = Decimal(str(tasa_compra))
    cycles = int(ciclos_dia)
    
    multiplier = (S / B) * (Decimal('1.0') - Cb) * (Decimal('1.0') - Cs)
    
    monto_venta = K * S * (Decimal('1.0') - Cs)
    monto_compra = monto_venta * (Decimal('1.0') - Cb) / B
    final_capital = monto_compra
        
    ganancia_ciclo = final_capital - K
    ganancia_porcentaje = (multiplier - Decimal('1.0')) * Decimal('100.0')
    ganancia_diaria = ganancia_ciclo * cycles
    ganancia_mensual = ganancia_diaria * Decimal('30.0')
    
    tasa_minima_compra = S * (Decimal('1.0') - Cb) * (Decimal('1.0') - Cs)
    
    return {
        'monto_venta': float(round(monto_venta, 2)),
        'monto_compra': float(round(monto_compra, 2)),
        'ganancia_porcentaje': float(round(ganancia_porcentaje, 4)),
        'ganancia_ciclo': float(round(ganancia_ciclo, 2)),
        'ganancia_diaria': float(round(ganancia_diaria, 2)),
        'ganancia_mensual': float(round(ganancia_mensual, 2)),
        'tasa_minima_compra': float(round(tasa_minima_compra, 3)),
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

    if None in [capital, tasa_venta, tasa_compra]:
        return Response(
            {"error": "Campos obligatorios faltantes (capital, tasa_venta, tasa_compra)"},
            status=status.HTTP_400_BAD_REQUEST
        )

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
    except Exception:
        return Response(
            {"error": "Error en el calculo"},
            status=status.HTTP_400_BAD_REQUEST
        )


from calculator.pagination import OptionalPageNumberPagination


class CalculationViewSet(viewsets.ModelViewSet):
    queryset = Calculation.objects.all()
    serializer_class = CalculationSerializer
    permission_classes = [RequireAuthForDestructive]
    pagination_class = OptionalPageNumberPagination
    
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
