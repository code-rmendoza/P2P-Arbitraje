from django.urls import reverse
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from .models import Wallet, Transaction


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
        from .views import _get_secret_token
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
