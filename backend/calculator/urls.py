from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    CalculationViewSet, DailyLogViewSet, 
    WalletViewSet, TransactionViewSet,
    calculate_p2p, get_bcv_rate, reset_database, check_update, apply_update, get_auth_token
)

router = DefaultRouter()
router.register(r'history', CalculationViewSet, basename='calculation')
router.register(r'logs', DailyLogViewSet, basename='dailylog')
router.register(r'wallets', WalletViewSet, basename='wallet')
router.register(r'transactions', TransactionViewSet, basename='transaction')

urlpatterns = [
    path('calculate/', calculate_p2p, name='calculate'),
    path('bcv-rate/', get_bcv_rate, name='bcv-rate'),
    path('reset-db/', reset_database, name='reset-db'),
    path('update-check/', check_update, name='update-check'),
    path('update-apply/', apply_update, name='update-apply'),
    path('auth-token/', get_auth_token, name='auth-token'),
    path('', include(router.urls)),
]
