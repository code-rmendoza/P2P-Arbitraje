from django.urls import reverse
from django.utils import timezone
from decimal import Decimal
from rest_framework import status
from rest_framework.test import APITestCase

from .models import Wallet, Transaction, DailyLog, Calculation
from .views import _get_secret_token


class TransactionLedgerTests(APITestCase):
    def setUp(self):
        self.binance = Wallet.objects.create(
            name='Binance USDT',
            platform='Binance',
            currency='USDT',
            balance=500,
            color='#f3ba2f',
        )
        self.zinli = Wallet.objects.create(
            name='Zinli USD',
            platform='Zinli',
            currency='USD',
            balance=200,
            color='#2563eb',
        )
        self.url = reverse('transaction-list')
        # Get auth token for destructive operations
        token = _get_secret_token()
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {token}')

    def test_creating_transaction_updates_balances(self):
        response = self.client.post(self.url, {
            'date': timezone.now().isoformat(),
            'type': 'VENTA_P2P',
            'wallet_from': self.binance.id,
            'wallet_to': self.zinli.id,
            'amount_out': 450,
            'amount_in': 471,
            'rate': 1.048,
            'commission_pct': 0.35,
            'notes': 'Venta de prueba',
        }, format='json')

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.binance.refresh_from_db()
        self.zinli.refresh_from_db()
        self.assertEqual(self.binance.balance, 50)
        self.assertEqual(self.zinli.balance, 671)

    def test_insufficient_balance_rejects_transaction(self):
        response = self.client.post(self.url, {
            'date': timezone.now().isoformat(),
            'type': 'VENTA_P2P',
            'wallet_from': self.binance.id,
            'wallet_to': self.zinli.id,
            'amount_out': 600,
            'amount_in': 628.8,
            'rate': 1.048,
            'commission_pct': 0.35,
            'notes': '',
        }, format='json')

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.binance.refresh_from_db()
        self.zinli.refresh_from_db()
        self.assertEqual(self.binance.balance, 500)
        self.assertEqual(self.zinli.balance, 200)

    def test_deleting_transaction_reverses_balances(self):
        tx = Transaction.objects.create(
            date=timezone.now(),
            type='VENTA_P2P',
            wallet_from=self.binance,
            wallet_to=self.zinli,
            amount_out=100,
            amount_in=104,
            rate=1.04,
            commission_pct=0.35,
        )
        self.binance.balance = 400
        self.binance.save()
        self.zinli.balance = 304
        self.zinli.save()

        response = self.client.delete(reverse('transaction-detail', args=[tx.id]))

        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        self.binance.refresh_from_db()
        self.zinli.refresh_from_db()
        self.assertEqual(self.binance.balance, 500)
        self.assertEqual(self.zinli.balance, 200)

    def test_wallet_filter_returns_related_transactions(self):
        Transaction.objects.create(
            date=timezone.now(),
            type='VENTA_P2P',
            wallet_from=self.binance,
            wallet_to=self.zinli,
            amount_out=100,
            amount_in=104,
            rate=1.04,
            commission_pct=0.35,
        )

        response = self.client.get(self.url, {'wallet': self.binance.id})

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)


class AuthRequiredTests(APITestCase):
    """Tests that destructive operations require auth token."""
    def setUp(self):
        self.token = _get_secret_token()

    def test_delete_wallet_requires_auth(self):
        wallet = Wallet.objects.create(name='Test', platform='P', currency='USDT')
        # No auth -> 403
        resp = self.client.delete(reverse('wallet-detail', args=[wallet.id]))
        self.assertEqual(resp.status_code, status.HTTP_403_FORBIDDEN)
        # With auth -> 204
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {self.token}')
        resp = self.client.delete(reverse('wallet-detail', args=[wallet.id]))
        self.assertEqual(resp.status_code, status.HTTP_204_NO_CONTENT)

    def test_put_wallet_requires_auth(self):
        wallet = Wallet.objects.create(name='Test', platform='P', currency='USDT', balance=100)
        data = {'name': 'Test', 'platform': 'P', 'currency': 'USDT', 'balance': 200, 'color': '#000'}
        # No auth -> 403
        resp = self.client.put(reverse('wallet-detail', args=[wallet.id]), data, format='json')
        self.assertEqual(resp.status_code, status.HTTP_403_FORBIDDEN)
        # With auth -> 200
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {self.token}')
        resp = self.client.put(reverse('wallet-detail', args=[wallet.id]), data, format='json')
        self.assertEqual(resp.status_code, status.HTTP_200_OK)

    def test_delete_log_requires_auth(self):
        log = DailyLog.objects.create(date=timezone.now().date(), profit=10, volume=100)
        # No auth -> 403
        resp = self.client.delete(reverse('dailylog-detail', args=[log.id]))
        self.assertEqual(resp.status_code, status.HTTP_403_FORBIDDEN)
        # With auth -> 204
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {self.token}')
        resp = self.client.delete(reverse('dailylog-detail', args=[log.id]))
        self.assertEqual(resp.status_code, status.HTTP_204_NO_CONTENT)

    def test_get_wallets_open_no_auth(self):
        resp = self.client.get(reverse('wallet-list'))
        self.assertEqual(resp.status_code, status.HTTP_200_OK)

    def test_post_wallet_open_no_auth(self):
        resp = self.client.post(reverse('wallet-list'), {
            'name': 'Test', 'platform': 'P', 'currency': 'USDT', 'balance': 50, 'color': '#000'
        }, format='json')
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED)


class DecimalFieldTests(APITestCase):
    """Tests that DecimalField arithmetic is precise."""
    def setUp(self):
        self.token = _get_secret_token()
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {self.token}')
        self.w1 = Wallet.objects.create(name='W1', platform='P', currency='USDT', balance=Decimal('100.00'))
        self.w2 = Wallet.objects.create(name='W2', platform='P', currency='USD', balance=Decimal('50.00'))

    def test_decimal_balance_precision(self):
        self.w1.balance += Decimal('0.1')
        self.w1.save()
        self.w1.refresh_from_db()
        self.assertEqual(self.w1.balance, Decimal('100.10'))

    def test_transaction_preserves_decimal(self):
        resp = self.client.post(reverse('transaction-list'), {
            'date': timezone.now().isoformat(),
            'type': 'TRANSFERENCIA',
            'wallet_from': self.w1.id,
            'wallet_to': self.w2.id,
            'amount_out': '33.33',
            'amount_in': '33.33',
            'rate': '1.0',
            'commission_pct': '0',
        }, format='json')
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED)
        self.w1.refresh_from_db()
        self.w2.refresh_from_db()
        self.assertEqual(self.w1.balance, Decimal('66.67'))
        self.assertEqual(self.w2.balance, Decimal('83.33'))


class CalculateValidationTests(APITestCase):
    """Tests input validation on /api/calculate/ endpoint."""
    def setUp(self):
        self.url = reverse('calculate')

    def test_missing_required_fields(self):
        resp = self.client.post(self.url, {}, format='json')
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)

    def test_non_numeric_capital(self):
        resp = self.client.post(self.url, {'capital': 'abc', 'tasa_venta': 100, 'tasa_compra': 90}, format='json')
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)

    def test_negative_capital(self):
        resp = self.client.post(self.url, {'capital': -100, 'tasa_venta': 100, 'tasa_compra': 90}, format='json')
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)

    def test_zero_tasa_compra(self):
        resp = self.client.post(self.url, {'capital': 1000, 'tasa_venta': 100, 'tasa_compra': 0}, format='json')
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)

    def test_comision_out_of_range(self):
        resp = self.client.post(self.url, {
            'capital': 1000, 'tasa_venta': 100, 'tasa_compra': 90,
            'comision_compra': 150
        }, format='json')
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)

    def test_valid_calculation(self):
        resp = self.client.post(self.url, {
            'capital': 1000, 'tasa_venta': 100, 'tasa_compra': 90,
            'ciclos_dia': 3
        }, format='json')
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertIn('ganancia_diaria', resp.data)
