import type { CSSProperties } from 'react';
import { Info, Edit3, X, Trash2 } from 'lucide-react';
import type { Wallet, Transaction } from '../api';
import { formatNumber } from '../utils/currency';

interface WalletsGridProps {
  wallets: Wallet[];
  portfolioStart: Date | null;
  portfolioEnd: Date | null;
  filteredTransactionsForRange: Transaction[];
  getWalletBalancesForRange: (wallet: Wallet, start: Date | null, end: Date | null) => { opening: number; closing: number };
  handleOpenWalletModal: (wallet?: Wallet) => void;
  handleDeactivateWallet: (wallet: Wallet) => void;
  handleDeleteWallet: (wallet: Wallet) => void;
}

export function WalletsGrid({
  wallets,
  portfolioStart,
  portfolioEnd,
  filteredTransactionsForRange,
  getWalletBalancesForRange,
  handleOpenWalletModal,
  handleDeactivateWallet,
  handleDeleteWallet,
}: WalletsGridProps) {
  if (wallets.length === 0) {
    return (
      <div className="empty-state">
        <Info className="empty-state-icon" />
        <div className="font-bold">Sin billeteras</div>
        <div className="text-muted-val font-small">Crea tus cuentas iniciales para empezar a registrar movimientos.</div>
      </div>
    );
  }

  return (
    <div className="wallets-grid">
      {wallets.map(wallet => {
        const { opening, closing } = getWalletBalancesForRange(wallet, portfolioStart, portfolioEnd);
        const walletDeposits = filteredTransactionsForRange
          .filter(tx => tx.type === 'DEPOSITO' && tx.wallet_to === wallet.id)
          .reduce((sum, tx) => sum + tx.amount_in, 0);
        const walletWithdrawals = filteredTransactionsForRange
          .filter(tx => tx.type === 'RETIRO' && tx.wallet_from === wallet.id)
          .reduce((sum, tx) => sum + tx.amount_out, 0);
        const walletProfit = closing - opening - walletDeposits + walletWithdrawals;

        return (
          <div key={wallet.id} className="wallet-card" style={{ '--wallet-color': wallet.color } as CSSProperties}>
            <div className="wallet-card-header">
              <div>
                <div className="wallet-name">{wallet.name}</div>
                <span className="wallet-platform-badge">{wallet.platform}</span>
              </div>
              {!wallet.is_active && <span className="badge badge-platform">Inactiva</span>}
            </div>
            <div className="wallet-balance-row">
              <span className="wallet-balance-val">{formatNumber(closing)}</span>
              <span className="wallet-balance-curr">{wallet.currency}</span>
            </div>
            <div className="wallet-meta-container metric-desc">
              <span>Inicial: {formatNumber(opening)} {wallet.currency}</span>
              <span style={{ fontWeight: 600, color: walletProfit > 0.0001 ? 'var(--color-success-hover)' : walletProfit < -0.0001 ? 'var(--color-danger)' : 'var(--text-muted)' }}>
                Profit: {walletProfit > 0.0001 ? '+' : ''}{formatNumber(walletProfit)} {wallet.currency}
              </span>
            </div>
            <div className="wallet-card-actions">
              <button className="btn btn-secondary btn-square-compact" onClick={() => handleOpenWalletModal(wallet)} title="Editar">
                <Edit3 className="icon-medium" />
              </button>
              {wallet.is_active ? (
                <button className="btn btn-secondary btn-square-compact" onClick={() => handleDeactivateWallet(wallet)} title="Desactivar">
                  <X className="icon-medium" />
                </button>
              ) : (
                <button className="btn btn-danger btn-square-compact" onClick={() => handleDeleteWallet(wallet)} title="Eliminar">
                  <Trash2 className="icon-medium" />
                </button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
