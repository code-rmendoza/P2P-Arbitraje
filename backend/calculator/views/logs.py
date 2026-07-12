from rest_framework import viewsets, status
from rest_framework.response import Response
from django.db import transaction as db_transaction
from decimal import Decimal, InvalidOperation

from calculator.models import DailyLog
from calculator.serializers import DailyLogSerializer
from calculator.auth import RequireAuthForDestructive


class DailyLogViewSet(viewsets.ModelViewSet):
    queryset = DailyLog.objects.all()
    serializer_class = DailyLogSerializer
    permission_classes = [RequireAuthForDestructive]

    def create(self, request, *args, **kwargs):
        accumulate = request.data.get('accumulate', False)
        
        if accumulate:
            date_val = request.data.get('date')
            tipo_operativa = request.data.get('tipo_operativa', 'USD')
            metodo_compra = request.data.get('metodo_compra', 'Zinli')
            metodo_venta = request.data.get('metodo_venta', 'Zinli')
            try:
                profit = Decimal(str(request.data.get('profit', 0)))
                volume = Decimal(str(request.data.get('volume', 0)))
            except (InvalidOperation, TypeError, ValueError):
                return Response(
                    {"error": "Los valores de profit y volume deben ser numericos validos."},
                    status=status.HTTP_400_BAD_REQUEST
                )
            notes = request.data.get('notes', '').strip()

            with db_transaction.atomic():
                existing = DailyLog.objects.select_for_update().filter(
                    date=date_val,
                    tipo_operativa=tipo_operativa,
                    metodo_compra=metodo_compra,
                    metodo_venta=metodo_venta
                ).first()

                if existing:
                    existing.profit = existing.profit + profit
                    existing.volume = existing.volume + volume
                    if notes:
                        if existing.notes:
                            existing.notes = (existing.notes + "\n" + notes).strip()
                        else:
                            existing.notes = notes
                    existing.save()
                    serializer = self.get_serializer(existing)
                    return Response(serializer.data, status=status.HTTP_200_OK)

        return super().create(request, *args, **kwargs)
