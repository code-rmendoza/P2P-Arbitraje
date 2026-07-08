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


class WalletSerializer(serializers.ModelSerializer):
    class Meta:
        model = Wallet
        fields = '__all__'
        read_only_fields = ['id', 'created_at']

    def create(self, validated_data):
        if 'opening_balance' not in validated_data:
            validated_data['opening_balance'] = validated_data.get('balance', 0.0)

        existing = Wallet.objects.filter(
            name=validated_data.get('name'),
            platform=validated_data.get('platform'),
            currency=validated_data.get('currency'),
        ).first()

        if existing:
            for field, value in validated_data.items():
                setattr(existing, field, value)
            existing.save()
            return existing

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
