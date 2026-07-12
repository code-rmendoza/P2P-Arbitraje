from rest_framework import viewsets, status
from rest_framework.response import Response
from django.utils import timezone
from django.db import transaction as db_transaction
from django.db.models import Q
from decimal import Decimal

from calculator.models import Wallet, Transaction, DailyLog
from calculator.serializers import WalletSerializer, TransactionSerializer
from calculator.auth import RequireAuthForDestructive


from calculator.pagination import OptionalPageNumberPagination


class WalletViewSet(viewsets.ModelViewSet):
    queryset = Wallet.objects.all()
    serializer_class = WalletSerializer
    permission_classes = [RequireAuthForDestructive]


class TransactionViewSet(viewsets.ModelViewSet):
    queryset = Transaction.objects.all()
    serializer_class = TransactionSerializer
    permission_classes = [RequireAuthForDestructive]
    pagination_class = OptionalPageNumberPagination

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
        Automatically creates a DailyLog for P2P transactions.
        """
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        
        wallet_from = data.get('wallet_from')
        wallet_to = data.get('wallet_to')
        amount_out = Decimal(str(data.get('amount_out', 0)))
        amount_in = Decimal(str(data.get('amount_in', 0)))
        tx_type = data.get('type')
        tasa_bcv_raw = request.data.get('tasa_bcv', 0)
        try:
            tasa_bcv = Decimal(str(tasa_bcv_raw))
        except Exception:
            tasa_bcv = Decimal('0')
        if tasa_bcv < 0:
            return Response(
                {"error": "La tasa BCV no puede ser negativa."},
                status=status.HTTP_400_BAD_REQUEST
            )

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
        if tx_type in ['DEPOSITO', 'INGRESO_EXTERNO'] and wallet_from:
            return Response(
                {"error": "Esta operación requiere origen externo (sin billetera origen)."},
                status=status.HTTP_400_BAD_REQUEST
            )
        if tx_type in ['RETIRO', 'GASTO'] and wallet_to:
            return Response(
                {"error": "Esta operación requiere destino externo (sin billetera destino)."},
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

            # Automatically create DailyLog on P2P transaction create
            if tx_type in ['COMPRA_P2P', 'VENTA_P2P']:
                def amount_to_usdt(amount, currency, bcv_rate):
                    if currency in ['USDT', 'USD']:
                        return amount
                    if currency == 'VES':
                        return amount / bcv_rate if bcv_rate > 0 else Decimal('0.0')
                    return Decimal('0.0')

                from_curr = wallet_from.currency if wallet_from else None
                to_curr = wallet_to.currency if wallet_to else None

                if from_curr in ['USDT', 'USD']:
                    vol = amount_out
                elif to_curr in ['USDT', 'USD']:
                    vol = amount_in
                else:
                    vol = amount_to_usdt(amount_out, from_curr, tasa_bcv)

                in_usdt = amount_to_usdt(amount_in, to_curr, tasa_bcv)
                out_usdt = amount_to_usdt(amount_out, from_curr, tasa_bcv)
                prof = in_usdt - out_usdt

                notes = f"[Auto-Transaccion #{instance.id}] Movimiento: {tx_type} | Ruta: {wallet_from.name if wallet_from else 'Externo'} → {wallet_to.name if wallet_to else 'Externo'} | Tasa: {instance.rate} | Notas: {instance.notes or ''}"
                tipo_op = 'VES' if (from_curr == 'VES' or to_curr == 'VES') else 'USD'

                DailyLog.objects.create(
                    date=instance.date.date(),
                    profit=prof.quantize(Decimal('0.0001')),
                    volume=vol.quantize(Decimal('0.01')),
                    notes=notes,
                    imported=True,
                    tipo_operativa=tipo_op,
                    plataforma_compra=wallet_to.platform if tx_type == 'COMPRA_P2P' else wallet_from.platform,
                    plataforma_venta=wallet_from.platform if tx_type == 'VENTA_P2P' else wallet_to.platform,
                    comision_compra=instance.commission_pct if tx_type == 'COMPRA_P2P' else Decimal('0'),
                    comision_venta=instance.commission_pct if tx_type == 'VENTA_P2P' else Decimal('0'),
                    metodo_compra=wallet_to.name if tx_type == 'COMPRA_P2P' else wallet_from.name,
                    metodo_venta=wallet_from.name if tx_type == 'VENTA_P2P' else wallet_to.name,
                )

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
            wallet_from = None
            wallet_to = None
            if instance.wallet_from:
                wallet_from = Wallet.objects.select_for_update().get(pk=instance.wallet_from.pk)
            if instance.wallet_to:
                wallet_to = Wallet.objects.select_for_update().get(pk=instance.wallet_to.pk)

            # Reverse: add back to origin, subtract from destination
            if wallet_from and instance.amount_out > 0:
                wallet_from.balance += instance.amount_out
                wallet_from.save(update_fields=['balance'])
            
            if wallet_to and instance.amount_in > 0:
                wallet_to.balance -= instance.amount_in
                wallet_to.save(update_fields=['balance'])
            
            # Atomically delete associated auto-created DailyLog
            DailyLog.objects.filter(notes__contains=f"[Auto-Transaccion #{instance.id}]").delete()
            
            instance.delete()
        
        return Response(status=status.HTTP_204_NO_CONTENT)

