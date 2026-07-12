import re
from decimal import Decimal, InvalidOperation
from rest_framework import serializers
from .models import Calculation, DailyLog, Wallet, Transaction


class CalculationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Calculation
        fields = '__all__'
        read_only_fields = [
            'id', 'created_at', 'monto_venta', 'monto_compra', 
            'ganancia_porcentaje', 'ganancia_ciclo', 'ganancia_diaria', 
            'ganancia_mensual', 'tasa_minima_compra'
        ]


class DailyLogSerializer(serializers.ModelSerializer):
    class Meta:
        model = DailyLog
        fields = '__all__'

    def validate_volume(self, value):
        try:
            d = Decimal(str(value))
        except (InvalidOperation, TypeError, ValueError):
            raise serializers.ValidationError("Volumen no es un numero decimal valido.")
        if d < 0:
            raise serializers.ValidationError("El volumen no puede ser negativo.")
        return value

    def validate_profit(self, value):
        try:
            d = Decimal(str(value))
        except (InvalidOperation, TypeError, ValueError):
            raise serializers.ValidationError("Ganancia no es un numero decimal valido.")
        if d < 0:
            raise serializers.ValidationError("La ganancia no puede ser negativa.")
        return value

    def validate_date(self, value):
        if not value:
            raise serializers.ValidationError("La fecha es obligatoria.")
        return value


class WalletSerializer(serializers.ModelSerializer):
    class Meta:
        model = Wallet
        fields = '__all__'
        read_only_fields = ['id', 'created_at']

    def validate_color(self, value):
        if value and not re.match(r'^#([0-9A-Fa-f]{6}|[0-9A-Fa-f]{3})$', value):
            raise serializers.ValidationError("Color debe ser un codigo hex valido (ej: #FF5733).")
        return value

    def validate(self, data):
        name = data.get('name', getattr(self.instance, 'name', '')).strip().lower()
        platform = data.get('platform', getattr(self.instance, 'platform', '')).strip().lower()
        currency = data.get('currency', getattr(self.instance, 'currency', ''))
        qs = Wallet.objects.filter(name__iexact=name, platform__iexact=platform, currency=currency)
        if self.instance:
            qs = qs.exclude(pk=self.instance.pk)
        if qs.exists():
            raise serializers.ValidationError(
                "Ya existe una billetera con el mismo nombre, plataforma y moneda."
            )
        return data

    def create(self, validated_data):
        if 'opening_balance' not in validated_data:
            validated_data['opening_balance'] = validated_data.get('balance', Decimal('0.0'))

        return super().create(validated_data)


class TransactionSerializer(serializers.ModelSerializer):
    wallet_from_name = serializers.CharField(source='wallet_from.name', read_only=True, default=None)
    wallet_to_name = serializers.CharField(source='wallet_to.name', read_only=True, default=None)
    wallet_from_currency = serializers.CharField(source='wallet_from.currency', read_only=True, default=None)
    wallet_to_currency = serializers.CharField(source='wallet_to.currency', read_only=True, default=None)
    wallet_from_platform = serializers.CharField(source='wallet_from.platform', read_only=True, default=None)
    wallet_to_platform = serializers.CharField(source='wallet_to.platform', read_only=True, default=None)

    class Meta:
        model = Transaction
        fields = '__all__'
        read_only_fields = ['id', 'created_at']
