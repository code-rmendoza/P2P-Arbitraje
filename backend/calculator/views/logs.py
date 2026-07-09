from rest_framework import viewsets, status
from rest_framework.response import Response
from django.db import transaction as db_transaction

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
            profit = float(request.data.get('profit', 0.0))
            volume = float(request.data.get('volume', 0.0))
            notes = request.data.get('notes', '').strip()

            with db_transaction.atomic():
                # Buscar registro existente para el mismo día, operativa y ruta
                existing = DailyLog.objects.select_for_update().filter(
                    date=date_val,
                    tipo_operativa=tipo_operativa,
                    metodo_compra=metodo_compra,
                    metodo_venta=metodo_venta
                ).first()

                if existing:
                    existing.profit = float(existing.profit) + profit
                    existing.volume = float(existing.volume) + volume
                    if notes:
                        if existing.notes:
                            existing.notes = (existing.notes + "\n" + notes).strip()
                        else:
                            existing.notes = notes
                    existing.save()
                    serializer = self.get_serializer(existing)
                    return Response(serializer.data, status=status.HTTP_200_OK)

        return super().create(request, *args, **kwargs)
