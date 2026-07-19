import { ArrowRight, Trash2 } from 'lucide-react';
import type { Wallet, Transaction } from '../api';
import { formatNumber } from '../utils/currency';

interface TransactionLedgerProps {
  wallets: Wallet[];
  displayedTransactions: Transaction[];
  ledgerWalletFilter: string;
  setLedgerWalletFilter: (v: string) => void;
  ledgerLimit: string;
  setLedgerLimit: (v: string) => void;
  handleDeleteTransaction: (tx: Transaction) => void;
}

export function TransactionLedger({
  wallets,
  displayedTransactions,
  ledgerWalletFilter,
  setLedgerWalletFilter,
  ledgerLimit,
  setLedgerLimit,
  handleDeleteTransaction,
}: TransactionLedgerProps) {
  return (
    <div className="ledger-container">
      <div className="ledger-filter-row">
        <h3 className="card-title select-filter-limit">Historial de Movimientos</h3>
        <div className="action-buttons-group">
          <select className="form-input select-filter-auto" value={ledgerWalletFilter} onChange={(e) => setLedgerWalletFilter(e.target.value)}>
            <option value="">Todas las billeteras</option>
            {wallets.map(wallet => (
              <option key={wallet.id} value={wallet.id}>{wallet.name}</option>
            ))}
          </select>
          <select className="form-input select-filter-limit" value={ledgerLimit} onChange={(e) => setLedgerLimit(e.target.value)}>
            <option value="5">Ultimos 5</option>
            <option value="10">Ultimos 10</option>
            <option value="20">Ultimos 20</option>
            <option value="all">Ver todos</option>
          </select>
        </div>
      </div>

      <div className="table-responsive">
        <table className="custom-table">
          <thead>
            <tr>
              <th>Fecha</th>
              <th>Tipo</th>
              <th>Ruta</th>
              <th>Sale</th>
              <th>Entra</th>
              <th>Tasa</th>
              <th>Comision</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {displayedTransactions.length === 0 ? (
              <tr>
                <td colSpan={8} className="text-center text-muted-val">Sin movimientos registrados.</td>
              </tr>
            ) : (
              displayedTransactions.map(tx => (
                <tr key={tx.id}>
                  <td>{new Date(tx.date).toLocaleString()}</td>
                  <td>
                    <span className={`tx-badge ${tx.type.toLowerCase().replace('_p2p', '').replace('_externo', '')}`}>
                      {tx.type.replace('_P2P', '').replace('_EXTERNO', ' NO P2P')}
                    </span>
                    {tx.category && <div className="metric-desc" style={{ fontSize: '0.75rem', marginTop: '0.1rem' }}>{tx.category}</div>}
                  </td>
                  <td>
                    <div className="tx-route-col">
                      <span>{tx.wallet_from_name || 'Externo'}</span>
                      <ArrowRight className="tx-route-arrow icon-medium" />
                      <span>{tx.wallet_to_name || 'Externo'}</span>
                    </div>
                  </td>
                  <td className="tx-amount-out">-{formatNumber(tx.amount_out)} {tx.wallet_from_currency || ''}</td>
                  <td className="tx-amount-in">+{formatNumber(tx.amount_in)} {tx.wallet_to_currency || ''}</td>
                  <td>{tx.rate.toFixed(4)}</td>
                  <td>{tx.commission_pct.toFixed(2)}%</td>
                  <td>
                    <button className="btn btn-danger btn-square-ledger" onClick={() => handleDeleteTransaction(tx)} title="Eliminar">
                      <Trash2 className="icon-small" />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
