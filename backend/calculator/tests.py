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

    def test_deleting_transaction_deletes_associated_daily_log(self):
        # Create transaction via API (this automatically creates DailyLog)
        response = self.client.post(self.url, {
            'date': timezone.now().isoformat(),
            'type': 'VENTA_P2P',
            'wallet_from': self.binance.id,
            'wallet_to': self.zinli.id,
            'amount_out': 100,
            'amount_in': 104,
            'rate': 1.04,
            'commission_pct': 0.35,
            'notes': 'Log testing transaction',
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        tx_id = response.data['id']
        
        # Verify DailyLog was created
        logs_count = DailyLog.objects.filter(notes__contains=f"[Auto-Transaccion #{tx_id}]").count()
        self.assertEqual(logs_count, 1)
        
        # Delete transaction via API
        del_response = self.client.delete(reverse('transaction-detail', args=[tx_id]))
        self.assertEqual(del_response.status_code, status.HTTP_204_NO_CONTENT)
        
        # Verify DailyLog was deleted
        logs_count_after = DailyLog.objects.filter(notes__contains=f"[Auto-Transaccion #{tx_id}]").count()
        self.assertEqual(logs_count_after, 0)

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
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        
        # Poll progress endpoint for the error
        import time
        error_found = False
        for _ in range(50):
            time.sleep(0.05)
            progress_resp = self.client.get(reverse('update-progress'))
            if progress_resp.data['status'] == 'error':
                self.assertIn('Falta firma digital', progress_resp.data['error_message'])
                error_found = True
                break
        self.assertTrue(error_found)

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
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        
        # Poll progress endpoint for the error
        import time
        error_found = False
        for _ in range(50):
            time.sleep(0.05)
            progress_resp = self.client.get(reverse('update-progress'))
            if progress_resp.data['status'] == 'error':
                self.assertIn('Violacion de integridad', progress_resp.data['error_message'])
                error_found = True
                break
        self.assertTrue(error_found)

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


class TransactionValidationTests(APITestCase):
    """Tests for additional transaction validation rules."""
    def setUp(self):
        self.token = _get_secret_token()
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {self.token}')
        self.w1 = Wallet.objects.create(name='W1', platform='P', currency='USDT', balance=Decimal('100.00'))
        self.w2 = Wallet.objects.create(name='W2', platform='P', currency='USD', balance=Decimal('50.00'))
        self.url = reverse('transaction-list')

    def test_update_returns_405(self):
        tx = Transaction.objects.create(
            date=timezone.now(), type='TRANSFERENCIA',
            wallet_from=self.w1, wallet_to=self.w2,
            amount_out=10, amount_in=10, rate=1, commission_pct=0,
        )
        resp = self.client.put(reverse('transaction-detail', args=[tx.id]), {
            'date': timezone.now().isoformat(),
            'type': 'TRANSFERENCIA',
            'wallet_from': self.w1.id,
            'wallet_to': self.w2.id,
            'amount_out': 20, 'amount_in': 20, 'rate': 1, 'commission_pct': 0,
        }, format='json')
        self.assertEqual(resp.status_code, status.HTTP_405_METHOD_NOT_ALLOWED)

    def test_partial_update_returns_405(self):
        tx = Transaction.objects.create(
            date=timezone.now(), type='TRANSFERENCIA',
            wallet_from=self.w1, wallet_to=self.w2,
            amount_out=10, amount_in=10, rate=1, commission_pct=0,
        )
        resp = self.client.patch(reverse('transaction-detail', args=[tx.id]), {
            'amount_out': 20,
        }, format='json')
        self.assertEqual(resp.status_code, status.HTTP_405_METHOD_NOT_ALLOWED)

    def test_same_wallet_rejected(self):
        resp = self.client.post(self.url, {
            'date': timezone.now().isoformat(),
            'type': 'TRANSFERENCIA',
            'wallet_from': self.w1.id,
            'wallet_to': self.w1.id,
            'amount_out': 10, 'amount_in': 10, 'rate': 1, 'commission_pct': 0,
        }, format='json')
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)

    def test_no_wallets_rejected(self):
        resp = self.client.post(self.url, {
            'date': timezone.now().isoformat(),
            'type': 'TRANSFERENCIA',
            'wallet_from': None,
            'wallet_to': None,
            'amount_out': 0, 'amount_in': 0, 'rate': 1, 'commission_pct': 0,
        }, format='json')
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)

    def test_negative_amounts_rejected(self):
        resp = self.client.post(self.url, {
            'date': timezone.now().isoformat(),
            'type': 'TRANSFERENCIA',
            'wallet_from': self.w1.id,
            'wallet_to': self.w2.id,
            'amount_out': -5, 'amount_in': 10, 'rate': 1, 'commission_pct': 0,
        }, format='json')
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)

    def test_deposito_without_wallet_from(self):
        resp = self.client.post(self.url, {
            'date': timezone.now().isoformat(),
            'type': 'DEPOSITO',
            'wallet_from': None,
            'wallet_to': self.w1.id,
            'amount_out': 0, 'amount_in': 50, 'rate': 1, 'commission_pct': 0,
        }, format='json')
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED)

    def test_deposito_with_wallet_from_rejected(self):
        resp = self.client.post(self.url, {
            'date': timezone.now().isoformat(),
            'type': 'DEPOSITO',
            'wallet_from': self.w1.id,
            'wallet_to': self.w2.id,
            'amount_out': 10, 'amount_in': 10, 'rate': 1, 'commission_pct': 0,
        }, format='json')
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)

    def test_retiro_without_wallet_to(self):
        resp = self.client.post(self.url, {
            'date': timezone.now().isoformat(),
            'type': 'RETIRO',
            'wallet_from': self.w1.id,
            'wallet_to': None,
            'amount_out': 10, 'amount_in': 0, 'rate': 1, 'commission_pct': 0,
        }, format='json')
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED)

    def test_retiro_with_wallet_to_rejected(self):
        resp = self.client.post(self.url, {
            'date': timezone.now().isoformat(),
            'type': 'RETIRO',
            'wallet_from': self.w1.id,
            'wallet_to': self.w2.id,
            'amount_out': 10, 'amount_in': 10, 'rate': 1, 'commission_pct': 0,
        }, format='json')
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)

    def test_p2p_requires_both_wallets(self):
        resp = self.client.post(self.url, {
            'date': timezone.now().isoformat(),
            'type': 'VENTA_P2P',
            'wallet_from': self.w1.id,
            'wallet_to': None,
            'amount_out': 10, 'amount_in': 0, 'rate': 1, 'commission_pct': 0,
        }, format='json')
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)


class SystemEndpointTests(APITestCase):
    """Tests for system utility endpoints."""
    def test_get_version(self):
        resp = self.client.get(reverse('version'))
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertIn('version', resp.data)

    def test_get_auth_token_dev_mode(self):
        from django.conf import settings
        old_debug = settings.DEBUG
        try:
            settings.DEBUG = True
            resp = self.client.get(reverse('auth-token'), HTTP_HOST='localhost')
            self.assertEqual(resp.status_code, status.HTTP_200_OK)
            self.assertIn('token', resp.data)
        finally:
            settings.DEBUG = old_debug

    def test_get_auth_token_production_blocked(self):
        from django.conf import settings
        old_debug = settings.DEBUG
        try:
            settings.DEBUG = False
            resp = self.client.get(reverse('auth-token'), HTTP_HOST='localhost')
            self.assertEqual(resp.status_code, status.HTTP_403_FORBIDDEN)
        finally:
            settings.DEBUG = old_debug

    @patch('requests.get')
    def test_apply_update_rejects_same_version(self, mock_get):
        from calculator.utils import _get_data_dir, load_json, parse_version
        token = _get_secret_token()
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {token}')

        # Read current version
        data_dir = _get_data_dir()
        vf = load_json(data_dir / 'version.json', None)
        if vf is None:
            from pathlib import Path
            vf = load_json(Path(__file__).resolve().parent.parent.parent / 'version.json', {'version': '0.0.0'})
        current_ver = vf.get('version', '0.0.0')

        class MockReleaseResponse:
            status_code = 200
            def json(self):
                import struct
                suffix = "_x64" if struct.calcsize("P") * 8 == 64 else "_x86"
                return {
                    "tag_name": f"v{current_ver}",
                    "assets": [{"name": f"P2P_Arbitrage{suffix}.zip", "browser_download_url": f"https://github.com/code-rmendoza/P2P-Arbitraje/releases/download/v{current_ver}/P2P_Arbitrage{suffix}.zip"}]
                }

        mock_get.return_value = MockReleaseResponse()
        resp = self.client.post(reverse('update-apply'))
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)

    @patch('requests.get')
    def test_check_update_rate_limit(self, mock_get):
        from calculator.utils import _get_data_dir
        token = _get_secret_token()
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {token}')

        class MockReleaseResponse:
            status_code = 200
            def json(self):
                return {"tag_name": "v99.0.0", "assets": []}

        mock_get.return_value = MockReleaseResponse()

        # Exhaust rate limit (10 checks/day)
        for _ in range(10):
            self.client.get(reverse('update-check'))

        # 11th should be rate limited
        resp = self.client.get(reverse('update-check'))
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertTrue(resp.data.get('rate_limited'))

        # Reset state for other tests
        import json
        state_path = _get_data_dir() / 'update_state.json'
        state_path.write_text(json.dumps({"last_check_date": "", "checks_today": 0}))
