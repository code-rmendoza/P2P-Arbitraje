from django.contrib import admin
from .models import Calculation, DailyLog, Wallet, Transaction


@admin.register(Calculation)
class CalculationAdmin(admin.ModelAdmin):
    list_display = ('label', 'tipo_operativa', 'capital', 'ganancia_ciclo', 'created_at')
    list_filter = ('tipo_operativa', 'plataforma_compra', 'plataforma_venta')
    search_fields = ('label', 'metodo_compra', 'metodo_venta')


@admin.register(DailyLog)
class DailyLogAdmin(admin.ModelAdmin):
    list_display = ('date', 'tipo_operativa', 'profit', 'volume', 'imported')
    list_filter = ('tipo_operativa', 'imported', 'date')
    search_fields = ('notes', 'metodo_compra', 'metodo_venta')


@admin.register(Wallet)
class WalletAdmin(admin.ModelAdmin):
    list_display = ('name', 'platform', 'currency', 'balance', 'opening_balance', 'is_active')
    list_filter = ('platform', 'currency', 'is_active')
    search_fields = ('name', 'platform')


@admin.register(Transaction)
class TransactionAdmin(admin.ModelAdmin):
    list_display = ('date', 'type', 'wallet_from', 'amount_out', 'wallet_to', 'amount_in', 'rate')
    list_filter = ('type', 'date')
    search_fields = ('notes', 'wallet_from__name', 'wallet_to__name')
