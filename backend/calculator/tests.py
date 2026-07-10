from django.urls import reverse
from django.utils import timezone
from decimal import Decimal
from rest_framework import status
from rest_framework.test import APITestCase
from unittest.mock import patch

from .models import Wallet, Transaction, DailyLog, Calculation
from .auth import _get_secret_token


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

    def test_post_wallet_requires_auth(self):
        # No auth -> 403
        self.client.credentials()  # clear credentials
        resp = self.client.post(reverse('wallet-list'), {
            'name': 'Test', 'platform': 'P', 'currency': 'USDT', 'balance': 50, 'color': '#000'
        }, format='json')
        self.assertEqual(resp.status_code, status.HTTP_403_FORBIDDEN)

        # With auth -> 201
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {self.token}')
        resp = self.client.post(reverse('wallet-list'), {
            'name': 'Test2', 'platform': 'P', 'currency': 'USDT', 'balance': 50, 'color': '#000'
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


class FinancialRobustnessTests(APITestCase):
    """Tests for the new Financial Robustness and Data Consistency logic."""
    def setUp(self):
        self.token = _get_secret_token()
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {self.token}')

    def test_duplicate_wallet_rejected(self):
        # Create initial wallet
        Wallet.objects.create(name='Binance USDT', platform='Binance', currency='USDT', balance=100)
        
        # Try to post duplicate wallet with different balance -> 400 Bad Request
        resp = self.client.post(reverse('wallet-list'), {
            'name': 'Binance USDT',
            'platform': 'Binance',
            'currency': 'USDT',
            'balance': 200,
            'color': '#ff0000'
        }, format='json')
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)
        # Check that unique constraint validation caught the duplicate
        self.assertIn('non_field_errors', resp.data)

    def test_daily_log_accumulation(self):
        log_url = reverse('dailylog-list')
        
        # Create first daily log
        resp1 = self.client.post(log_url, {
            'date': '2026-07-09',
            'profit': 15.50,
            'volume': 1000.00,
            'notes': 'Primer movimiento',
            'tipo_operativa': 'USD',
            'metodo_compra': 'Zinli',
            'metodo_venta': 'Zinli'
        }, format='json')
        self.assertEqual(resp1.status_code, status.HTTP_201_CREATED)
        
        # Post another log with accumulate = True -> 200 OK and sums fields
        resp2 = self.client.post(log_url, {
            'date': '2026-07-09',
            'profit': 10.25,
            'volume': 500.00,
            'notes': 'Segundo movimiento',
            'tipo_operativa': 'USD',
            'metodo_compra': 'Zinli',
            'metodo_venta': 'Zinli',
            'accumulate': True
        }, format='json')
        self.assertEqual(resp2.status_code, status.HTTP_200_OK)
        
        # Verify changes in DB
        self.assertEqual(DailyLog.objects.count(), 1)
        log = DailyLog.objects.first()
        self.assertEqual(float(log.profit), 25.75)
        self.assertEqual(float(log.volume), 1500.00)
        self.assertIn('Primer movimiento\nSegundo movimiento', log.notes)


class SecurityDevOpsTests(APITestCase):
    """Tests for auto-updater SHA-256 verification and security validation."""
    def setUp(self):
        self.token = _get_secret_token()
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {self.token}')

    @patch('requests.get')
    def test_apply_update_missing_checksum(self, mock_get):
        class MockReleaseResponse:
            status_code = 200
            def json(self):
                return {
                    "tag_name": "v9.9.9",
                    "assets": [
                        {
                            "name": "P2P_Arbitrage.zip",
                            "browser_download_url": "https://github.com/code-rmendoza/P2P-Arbitraje/releases/download/v9.9.9/P2P_Arbitrage.zip"
                        }
                    ]
                }
        
        class MockDownloadResponse:
            status_code = 200
            def raise_for_status(self):
                pass
            def iter_content(self, chunk_size=8192):
                return [b"file data"]

        def side_effect(url, *args, **kwargs):
            if "releases/latest" in url:
                return MockReleaseResponse()
            return MockDownloadResponse()

        mock_get.side_effect = side_effect

        resp = self.client.post(reverse('update-apply'))
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('Falta firma digital', resp.data['error'])

    @patch('requests.get')
    def test_apply_update_invalid_checksum(self, mock_get):
        class MockReleaseResponse:
            status_code = 200
            def json(self):
                return {
                    "tag_name": "v9.9.9",
                    "assets": [
                        {
                            "name": "P2P_Arbitrage.zip",
                            "browser_download_url": "https://github.com/code-rmendoza/P2P-Arbitraje/releases/download/v9.9.9/P2P_Arbitrage.zip"
                        },
                        {
                            "name": "P2P_Arbitrage.zip.sha256",
                            "browser_download_url": "https://github.com/code-rmendoza/P2P-Arbitraje/releases/download/v9.9.9/P2P_Arbitrage.zip.sha256"
                        }
                    ]
                }
        
        class MockDownloadResponse:
            status_code = 200
            def raise_for_status(self):
                pass
            def iter_content(self, chunk_size=8192):
                return [b"file data"]

        class MockShaResponse:
            status_code = 200
            text = "wronghash12345wronghash12345wronghash12345wronghash12345wronghash"
            def raise_for_status(self):
                pass

        def side_effect(url, *args, **kwargs):
            if "releases/latest" in url:
                return MockReleaseResponse()
            if "P2P_Arbitrage.zip.sha256" in url:
                return MockShaResponse()
            return MockDownloadResponse()

        mock_get.side_effect = side_effect

        resp = self.client.post(reverse('update-apply'))
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('Violacion de integridad', resp.data['error'])

    @patch('requests.get')
    def test_check_update_matches_architecture(self, mock_get):
        import struct
        suffix = "_x64" if struct.calcsize("P") * 8 == 64 else "_x86"
        expected_zip = f"P2P_Arbitrage{suffix}.zip"
        
        class MockReleaseResponse:
            status_code = 200
            def json(self):
                return {
                    "tag_name": "v9.9.9",
                    "assets": [
                        {
                            "name": "P2P_Arbitrage_x86.zip",
                            "browser_download_url": "https://github.com/code-rmendoza/P2P-Arbitraje/releases/download/v9.9.9/P2P_Arbitrage_x86.zip"
                        },
                        {
                            "name": "P2P_Arbitrage_x64.zip",
                            "browser_download_url": "https://github.com/code-rmendoza/P2P-Arbitraje/releases/download/v9.9.9/P2P_Arbitrage_x64.zip"
                        }
                    ]
                }

        mock_get.return_value = MockReleaseResponse()
        
        resp = self.client.get(reverse('update-check'))
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertTrue(resp.data['update_available'])
        self.assertEqual(resp.data['latest_version'], '9.9.9')
        self.assertIn(expected_zip, resp.data['download_url'])

    @patch('requests.get')
    def test_check_update_fallback_generic(self, mock_get):
        class MockReleaseResponse:
            status_code = 200
            def json(self):
                return {
                    "tag_name": "v9.9.9",
                    "assets": [
                        {
                            "name": "P2P_Arbitrage.zip",
                            "browser_download_url": "https://github.com/code-rmendoza/P2P-Arbitraje/releases/download/v9.9.9/P2P_Arbitrage.zip"
                        }
                    ]
                }

        mock_get.return_value = MockReleaseResponse()
        
        resp = self.client.get(reverse('update-check'))
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertTrue(resp.data['update_available'])
        self.assertEqual(resp.data['latest_version'], '9.9.9')
        self.assertIn('P2P_Arbitrage.zip', resp.data['download_url'])

    @patch('requests.get')
    def test_bcv_rate_scraping_fails_uses_fallback(self, mock_get):
        # Clean up any existing cache file first to test cold start fallback
        import os
        from calculator.utils import _get_data_dir
        cache_path = _get_data_dir() / 'bcv_rate_cache.json'
        if cache_path.exists():
            try:
                os.remove(cache_path)
            except Exception:
                pass

        # Simulate connection error on requests.get
        mock_get.side_effect = Exception("Connection Timeout")

        resp = self.client.get(reverse('bcv-rate'))
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertEqual(resp.data['rate'], 36.50)
        self.assertTrue(resp.data['fallback_contingency'])
        self.assertIn('warning', resp.data)
