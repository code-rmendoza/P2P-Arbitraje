from django.db import models


class Calculation(models.Model):
    label = models.CharField(max_length=100)
    capital = models.DecimalField(max_digits=14, decimal_places=2)
    comision = models.DecimalField(max_digits=6, decimal_places=4, default=0.35)  # Legacy field
    
    # Multi-Currency / Multi-Platform fields
    tipo_operativa = models.CharField(max_length=20, default='USD')
    plataforma_compra = models.CharField(max_length=50, default='Binance P2P')
    plataforma_venta = models.CharField(max_length=50, default='Binance P2P')
    comision_compra = models.DecimalField(max_digits=6, decimal_places=4, default=0.35)
    comision_venta = models.DecimalField(max_digits=6, decimal_places=4, default=0.35)
    metodo_compra = models.CharField(max_length=50, default='Zinli')
    metodo_venta = models.CharField(max_length=50, default='Zinli')
    
    tasa_venta = models.DecimalField(max_digits=12, decimal_places=4)
    tasa_compra = models.DecimalField(max_digits=12, decimal_places=4)
    tasa_retorno = models.DecimalField(max_digits=6, decimal_places=4, default=1.0)
    
    ciclos_dia = models.IntegerField(default=1)
    metodos_pago = models.IntegerField(default=1)
    
    # Pre-calculated values
    monto_venta = models.DecimalField(max_digits=14, decimal_places=2)
    monto_compra = models.DecimalField(max_digits=14, decimal_places=2)
    ganancia_porcentaje = models.DecimalField(max_digits=8, decimal_places=4)
    ganancia_ciclo = models.DecimalField(max_digits=14, decimal_places=2)
    ganancia_diaria = models.DecimalField(max_digits=14, decimal_places=2)
    ganancia_mensual = models.DecimalField(max_digits=14, decimal_places=2)
    tasa_minima_compra = models.DecimalField(max_digits=12, decimal_places=4)
    
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.label} ({self.tipo_operativa}) - {self.capital} USDT"


class DailyLog(models.Model):
    date = models.DateField(db_index=True)
    profit = models.DecimalField(max_digits=14, decimal_places=2, default=0.0)
    volume = models.DecimalField(max_digits=14, decimal_places=2, default=0.0)
    imported = models.BooleanField(default=False)
    notes = models.TextField(blank=True, default='')
    
    tipo_operativa = models.CharField(max_length=20, default='USD')
    plataforma_compra = models.CharField(max_length=50, default='Binance P2P')
    plataforma_venta = models.CharField(max_length=50, default='Binance P2P')
    comision_compra = models.DecimalField(max_digits=6, decimal_places=4, default=0.35)
    comision_venta = models.DecimalField(max_digits=6, decimal_places=4, default=0.35)
    metodo_compra = models.CharField(max_length=50, default='Zinli')
    metodo_venta = models.CharField(max_length=50, default='Zinli')

    class Meta:
        ordering = ['-date', 'id']

    def __str__(self):
        return f"{self.date} [{self.tipo_operativa}] - Profit: {self.profit} USDT, Vol: {self.volume} USDT"


class Wallet(models.Model):
    CURRENCY_CHOICES = [
        ('USDT', 'USDT (Tether)'),
        ('USD', 'USD (Dólar)'),
        ('VES', 'VES (Bolívares)'),
    ]
    
    name = models.CharField(max_length=100)  # e.g. "Binance USDT Principal"
    platform = models.CharField(max_length=50)  # e.g. "Binance", "Zinli", "Banesco"
    currency = models.CharField(max_length=10, choices=CURRENCY_CHOICES)
    balance = models.DecimalField(max_digits=14, decimal_places=2, default=0.0)
    opening_balance = models.DecimalField(max_digits=14, decimal_places=2, default=0.0)
    is_active = models.BooleanField(default=True)
    color = models.CharField(max_length=7, default='#2563eb')  # Hex color for UI
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['platform', 'currency']
        constraints = [
            models.UniqueConstraint(
                fields=['name', 'platform', 'currency'],
                name='unique_wallet_identity'
            )
        ]

    def __str__(self):
        return f"{self.name} ({self.platform}) - {self.balance} {self.currency}"


class Transaction(models.Model):
    TYPE_CHOICES = [
        ('VENTA_P2P', 'Venta P2P'),
        ('COMPRA_P2P', 'Compra P2P'),
        ('DEPOSITO', 'Depósito'),
        ('RETIRO', 'Retiro'),
        ('TRANSFERENCIA', 'Transferencia'),
    ]
    
    date = models.DateTimeField(db_index=True)
    type = models.CharField(max_length=20, choices=TYPE_CHOICES)
    
    wallet_from = models.ForeignKey(
        Wallet, on_delete=models.SET_NULL, null=True, blank=True, 
        related_name='transactions_out'
    )
    wallet_to = models.ForeignKey(
        Wallet, on_delete=models.SET_NULL, null=True, blank=True, 
        related_name='transactions_in'
    )
    
    amount_out = models.DecimalField(max_digits=14, decimal_places=2, default=0.0)  # Sale de wallet_from
    amount_in = models.DecimalField(max_digits=14, decimal_places=2, default=0.0)   # Entra a wallet_to
    
    rate = models.DecimalField(max_digits=12, decimal_places=4, default=1.0)  # Tasa de cambio utilizada
    commission_pct = models.DecimalField(max_digits=6, decimal_places=4, default=0.0)  # Comisión P2P %
    
    notes = models.TextField(blank=True, default='')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-date']

    def __str__(self):
        fr = self.wallet_from.name if self.wallet_from else 'Externo'
        to = self.wallet_to.name if self.wallet_to else 'Externo'
        return f"{self.date.strftime('%Y-%m-%d %H:%M')} | {self.type}: {fr} → {to} | -{self.amount_out} / +{self.amount_in}"
