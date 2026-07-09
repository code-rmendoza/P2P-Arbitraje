import { WalletCards, Plus, Info, Edit3, X, Trash2, ArrowRight, CheckCircle, FileDown } from 'lucide-react';
import type { CSSProperties } from 'react';
import type { Wallet, Transaction } from '../api';
import { exportPortfolioPDF } from '../api/pdf';

interface PortfolioTabProps {
  wallets: Wallet[];
  portfolioStart: Date | null;
  portfolioEnd: Date | null;
  portfolioDateFilter: string;
  setPortfolioDateFilter: (v: string) => void;
  getWalletBalancesForRange: (wallet: Wallet, start: Date | null, end: Date | null) => { opening: number; closing: number };
  filteredTransactionsForRange: Transaction[];
  displayedTransactions: Transaction[];
  txWalletFrom: string;
  setTxWalletFrom: (v: string) => void;
  txWalletTo: string;
  setTxWalletTo: (v: string) => void;
  txTypeOverride: string;
  setTxTypeOverride: (v: any) => void;
  transactionType: string;
  txDate: string;
  setTxDate: (v: string) => void;
  txAmountOut: number;
  setTxAmountOut: (v: number) => void;
  txRate: number;
  setTxRate: (v: number) => void;
  txCommission: number;
  setTxCommission: (v: number) => void;
  txManualAmountIn: string;
  setTxManualAmountIn: (v: string) => void;
  txAmountInDisplay: string;
  txNotes: string;
  setTxNotes: (v: string) => void;
  ledgerWalletFilter: string;
  setLedgerWalletFilter: (v: string) => void;
  ledgerLimit: string;
  setLedgerLimit: (v: string) => void;
  activeWallets: Wallet[];
  selectedWalletFrom?: Wallet;
  selectedWalletTo?: Wallet;
  amountToUsdt: (amount: number, currency?: string | null, tasaBcv?: number) => number;
  tasaBcv: number;
  handleOpenWalletModal: (wallet?: Wallet) => void;
  handleDeactivateWallet: (wallet: Wallet) => void;
  handleDeleteWallet: (wallet: Wallet) => void;
  handleSaveTransaction: () => void;
  handleDeleteTransaction: (tx: Transaction) => void;
  handleResetSystem: () => void;
}

export function PortfolioTab({
  wallets,
  portfolioStart,
  portfolioEnd,
  portfolioDateFilter,
  setPortfolioDateFilter,
  getWalletBalancesForRange,
  filteredTransactionsForRange,
  displayedTransactions,
  txWalletFrom, setTxWalletFrom,
  txWalletTo, setTxWalletTo,
  txTypeOverride, setTxTypeOverride,
  transactionType,
  txDate, setTxDate,
  txAmountOut, setTxAmountOut,
  txRate, setTxRate,
  txCommission, setTxCommission,
  txManualAmountIn, setTxManualAmountIn,
  txAmountInDisplay,
  txNotes, setTxNotes,
  ledgerWalletFilter, setLedgerWalletFilter,
  ledgerLimit, setLedgerLimit,
  activeWallets,
  selectedWalletFrom,
  selectedWalletTo,
  amountToUsdt,
  tasaBcv,
  handleOpenWalletModal,
  handleDeactivateWallet,
  handleDeleteWallet,
  handleSaveTransaction,
  handleDeleteTransaction,
  handleResetSystem,
}: PortfolioTabProps) {
  const totalPortfolioUsdt = wallets
    .filter(wallet => wallet.is_active)
    .reduce((sum, wallet) => {
      const { closing } = getWalletBalancesForRange(wallet, portfolioStart, portfolioEnd);
      return sum + amountToUsdt(closing, wallet.currency, tasaBcv);
    }, 0);

  const groupedBalance = (currency: Wallet['currency']) => wallets
    .filter(wallet => wallet.is_active && wallet.currency === currency)
    .reduce((sum, wallet) => {
      const { closing } = getWalletBalancesForRange(wallet, portfolioStart, portfolioEnd);
      return sum + closing;
    }, 0);

  const currencies: Wallet['currency'][] = ['USDT', 'USD', 'VES'];
  const profitRows = currencies.map(currency => {
    const current = wallets
      .filter(wallet => wallet.currency === currency)
      .reduce((sum, wallet) => {
        const { closing } = getWalletBalancesForRange(wallet, portfolioStart, portfolioEnd);
        return sum + closing;
      }, 0);
    const opening = wallets
      .filter(wallet => wallet.currency === currency)
      .reduce((sum, wallet) => {
        const { opening } = getWalletBalancesForRange(wallet, portfolioStart, portfolioEnd);
        return sum + opening;
      }, 0);
    const deposits = filteredTransactionsForRange
      .filter(tx => tx.type === 'DEPOSITO' && tx.wallet_to_currency === currency)
      .reduce((sum, tx) => sum + tx.amount_in, 0);
    const withdrawals = filteredTransactionsForRange
      .filter(tx => tx.type === 'RETIRO' && tx.wallet_from_currency === currency)
      .reduce((sum, tx) => sum + tx.amount_out, 0);
    const profit = current - opening - deposits + withdrawals;

    return {
      currency,
      current,
      opening,
      deposits,
      withdrawals,
      profit,
      profitUsdt: amountToUsdt(profit, currency, tasaBcv),
    };
  });

  const totalOpeningUsdt = wallets.reduce(
    (sum, wallet) => {
      const { opening } = getWalletBalancesForRange(wallet, portfolioStart, portfolioEnd);
      return sum + amountToUsdt(opening, wallet.currency, tasaBcv);
    },
    0
  );
  const totalDepositsUsdt = filteredTransactionsForRange
    .filter(tx => tx.type === 'DEPOSITO')
    .reduce((sum, tx) => sum + amountToUsdt(tx.amount_in, tx.wallet_to_currency, tasaBcv), 0);
  const totalWithdrawalsUsdt = filteredTransactionsForRange
    .filter(tx => tx.type === 'RETIRO')
    .reduce((sum, tx) => sum + amountToUsdt(tx.amount_out, tx.wallet_from_currency, tasaBcv), 0);
  const realPortfolioProfitUsdt = profitRows.reduce((sum, row) => sum + row.profitUsdt, 0);
  const realPortfolioProfitPct = totalOpeningUsdt > 0
    ? (realPortfolioProfitUsdt / totalOpeningUsdt) * 100
    : 0;

  return (
    <div className="card">
      <div className="card-title">
        <WalletCards className="logo-icon" style={{ width: '1.5rem', height: '1.5rem' }} />
        Portafolio & Libro Contable
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.5rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '1rem' }}>
        <div className="card-subtitle" style={{ margin: 0 }}>
          Saldos reales por billetera y movimientos de doble entrada.
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
          <button className="btn btn-secondary" onClick={() => exportPortfolioPDF({
            wallets, transactions: displayedTransactions, totalUsdt: totalPortfolioUsdt,
            profitUsdt: realPortfolioProfitUsdt, profitPct: realPortfolioProfitPct, tasaBcv,
          })} title="Exportar portafolio a PDF" style={{ padding: '0.4rem 0.75rem', fontSize: '0.85rem', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
            <FileDown style={{ width: '0.85rem', height: '0.85rem' }} />
            Exportar PDF
          </button>
          <button className="btn btn-secondary" onClick={handleResetSystem} title="Restablecer base de datos" style={{ padding: '0.4rem 0.75rem', fontSize: '0.85rem', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: '0.3rem', color: '#dc2626', borderColor: '#fca5a5' }}>
            <Trash2 style={{ width: '0.85rem', height: '0.85rem' }} />
            Reiniciar Sistema
          </button>
          <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-muted)' }}>Filtrar Periodo:</span>
          <select className="form-input" style={{ width: '180px', padding: '0.4rem 0.75rem', fontSize: '0.85rem', margin: 0 }} value={portfolioDateFilter} onChange={(e) => setPortfolioDateFilter(e.target.value)}>
            <option value="today">Hoy</option>
            <option value="yesterday">Ayer</option>
            <option value="month">Este Mes</option>
            <option value="all">Historico General</option>
          </select>
        </div>
      </div>

      <div className="portfolio-kpi-row">
        <div className="metric-card success">
          <span className="metric-label">Total consolidado</span>
          <span className="metric-value">${totalPortfolioUsdt.toFixed(2)}</span>
          <span className="metric-desc">Estimado en USDT usando USD 1:1 y BCV para VES</span>
        </div>
        <div className={`metric-card ${realPortfolioProfitUsdt >= 0 ? 'success' : ''}`}>
          <span className="metric-label">Profit real</span>
          <span className="metric-value" style={{ color: realPortfolioProfitUsdt >= 0 ? 'var(--color-success)' : 'var(--color-danger)' }}>
            {realPortfolioProfitUsdt >= 0 ? '+' : ''}${realPortfolioProfitUsdt.toFixed(2)}
          </span>
          <span className="metric-desc">
            {realPortfolioProfitPct >= 0 ? '+' : ''}{realPortfolioProfitPct.toFixed(2)}% sobre capital inicial
          </span>
        </div>
        <div className="metric-card">
          <span className="metric-label">USDT</span>
          <span className="metric-value">{groupedBalance('USDT').toFixed(2)}</span>
          <span className="metric-desc">Disponible en wallets cripto</span>
        </div>
        <div className="metric-card accent">
          <span className="metric-label">USD</span>
          <span className="metric-value">{groupedBalance('USD').toFixed(2)}</span>
          <span className="metric-desc">Zinli, Wally u otros saldos USD</span>
        </div>
        <div className="metric-card warning">
          <span className="metric-label">VES</span>
          <span className="metric-value">{groupedBalance('VES').toFixed(0)}</span>
          <span className="metric-desc">Equiv. ${(tasaBcv > 0 ? groupedBalance('VES') / tasaBcv : 0).toFixed(2)} USDT</span>
        </div>
      </div>

      <div className="table-responsive">
        <table className="custom-table">
          <thead>
            <tr>
              <th>Moneda</th>
              <th>Saldo actual</th>
              <th>Capital inicial</th>
              <th>Depositos</th>
              <th>Retiros</th>
              <th>Profit real</th>
            </tr>
          </thead>
          <tbody>
            {profitRows.map(row => (
              <tr key={row.currency}>
                <td><span className="badge badge-platform">{row.currency}</span></td>
                <td>{row.current.toFixed(row.currency === 'VES' ? 0 : 2)}</td>
                <td>{row.opening.toFixed(row.currency === 'VES' ? 0 : 2)}</td>
                <td>{row.deposits.toFixed(row.currency === 'VES' ? 0 : 2)}</td>
                <td>{row.withdrawals.toFixed(row.currency === 'VES' ? 0 : 2)}</td>
                <td className={row.profit >= 0 ? 'tx-amount-in' : 'tx-amount-out'}>
                  {row.profit >= 0 ? '+' : ''}{row.profit.toFixed(row.currency === 'VES' ? 0 : 2)} {row.currency}
                </td>
              </tr>
            ))}
            <tr>
              <td><strong>Total USDT</strong></td>
              <td>{totalPortfolioUsdt.toFixed(2)}</td>
              <td>{totalOpeningUsdt.toFixed(2)}</td>
              <td>{totalDepositsUsdt.toFixed(2)}</td>
              <td>{totalWithdrawalsUsdt.toFixed(2)}</td>
              <td className={realPortfolioProfitUsdt >= 0 ? 'tx-amount-in' : 'tx-amount-out'}>
                {realPortfolioProfitUsdt >= 0 ? '+' : ''}{realPortfolioProfitUsdt.toFixed(2)} USDT
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className="ledger-filter-row">
        <h3 className="card-title" style={{ fontSize: '1.05rem', marginBottom: 0 }}>Billeteras</h3>
        <button className="btn btn-primary" onClick={() => handleOpenWalletModal()}>
          <Plus style={{ width: '1rem', height: '1rem' }} />
          Agregar Billetera
        </button>
      </div>

      {wallets.length === 0 ? (
        <div className="empty-state" style={{ padding: '2rem', marginBottom: '1.5rem' }}>
          <Info className="empty-state-icon" />
          <div style={{ fontWeight: 700 }}>Sin billeteras</div>
          <div style={{ fontSize: '0.85rem' }}>Crea tus cuentas iniciales para empezar a registrar movimientos.</div>
        </div>
      ) : (
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
                  <span className="wallet-balance-val">{closing.toFixed(wallet.currency === 'VES' ? 0 : 2)}</span>
                  <span className="wallet-balance-curr">{wallet.currency}</span>
                </div>
                <div className="metric-desc" style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
                  <span>Inicial: {opening.toFixed(wallet.currency === 'VES' ? 0 : 2)} {wallet.currency}</span>
                  <span style={{ fontWeight: 600, color: walletProfit > 0.0001 ? 'var(--color-success-hover)' : walletProfit < -0.0001 ? 'var(--color-danger)' : 'var(--text-muted)' }}>
                    Profit: {walletProfit > 0.0001 ? '+' : ''}{walletProfit.toFixed(wallet.currency === 'VES' ? 0 : 2)} {wallet.currency}
                  </span>
                </div>
                <div className="wallet-card-actions">
                  <button className="btn btn-secondary" style={{ padding: '0.35rem' }} onClick={() => handleOpenWalletModal(wallet)} title="Editar">
                    <Edit3 style={{ width: '0.9rem', height: '0.9rem' }} />
                  </button>
                  {wallet.is_active ? (
                    <button className="btn btn-secondary" style={{ padding: '0.35rem' }} onClick={() => handleDeactivateWallet(wallet)} title="Desactivar">
                      <X style={{ width: '0.9rem', height: '0.9rem' }} />
                    </button>
                  ) : (
                    <button className="btn btn-danger" style={{ padding: '0.35rem' }} onClick={() => handleDeleteWallet(wallet)} title="Eliminar">
                      <Trash2 style={{ width: '0.9rem', height: '0.9rem' }} />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="tx-separator"></div>

      <h3 className="card-title" style={{ fontSize: '1.05rem', marginBottom: '1rem' }}>Registrar Movimiento</h3>
      <div className="form-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
        <div className="form-group">
          <label className="form-label">Billetera Origen</label>
          <select className="form-input" value={txWalletFrom} onChange={(e) => setTxWalletFrom(e.target.value)}>
            <option value="">Externo / Deposito</option>
            {activeWallets.map(wallet => (
              <option key={wallet.id} value={wallet.id}>{wallet.name} - {wallet.balance.toFixed(2)} {wallet.currency}</option>
            ))}
          </select>
        </div>
        <div className="form-group">
          <label className="form-label">Billetera Destino</label>
          <select className="form-input" value={txWalletTo} onChange={(e) => setTxWalletTo(e.target.value)}>
            <option value="">Externo / Retiro</option>
            {activeWallets.map(wallet => (
              <option key={wallet.id} value={wallet.id}>{wallet.name} - {wallet.currency}</option>
            ))}
          </select>
        </div>
        <div className="form-group">
          <label className="form-label">Tipo</label>
          <select className="form-input" value={txTypeOverride} onChange={(e) => setTxTypeOverride(e.target.value)}>
            <option value="AUTO">Auto: {transactionType}</option>
            <option value="VENTA_P2P">VENTA_P2P</option>
            <option value="COMPRA_P2P">COMPRA_P2P</option>
            <option value="DEPOSITO">DEPOSITO</option>
            <option value="RETIRO">RETIRO</option>
            <option value="TRANSFERENCIA">TRANSFERENCIA</option>
          </select>
        </div>
        <div className="form-group">
          <label className="form-label">Fecha de Operacion</label>
          <input type="datetime-local" className="form-input" style={{ padding: '0.5rem 0.75rem', fontSize: '0.9rem' }} value={txDate} onChange={(e) => setTxDate(e.target.value)} />
        </div>
      </div>

      <div className="form-grid">
        <div className="form-group">
          <label className="form-label">Monto que sale <span className="suffix">{selectedWalletFrom?.currency || 'Origen'}</span></label>
          <input type="number" className="form-input" value={txAmountOut} onChange={(e) => setTxAmountOut(parseFloat(e.target.value) || 0)} onFocus={(e) => e.target.select()} min="0" step="0.01" />
        </div>
        <div className="form-group">
          <label className="form-label">Tasa</label>
          <input type="number" className="form-input" value={txRate} onChange={(e) => setTxRate(parseFloat(e.target.value) || 0)} onFocus={(e) => e.target.select()} min="0" step="0.001" />
        </div>
        <div className="form-group">
          <label className="form-label">Comision %</label>
          <input type="number" className="form-input" value={txCommission} onChange={(e) => setTxCommission(parseFloat(e.target.value) || 0)} onFocus={(e) => e.target.select()} min="0" step="0.05" />
        </div>
        <div className="form-group">
          <label className="form-label">Monto que entra <span className="suffix">{selectedWalletTo?.currency || 'Destino'}</span></label>
          <input type="number" className="form-input" value={txManualAmountIn || txAmountInDisplay} onChange={(e) => setTxManualAmountIn(e.target.value)} onFocus={(e) => e.target.select()} min="0" step="0.001" />
          <span className="metric-desc">Sugerido: {txAmountInDisplay} {selectedWalletTo?.currency || ''}</span>
        </div>
      </div>

      <div className="form-group" style={{ marginBottom: '1rem' }}>
        <label className="form-label">Notas</label>
        <input className="form-input" value={txNotes} onChange={(e) => setTxNotes(e.target.value)} onFocus={(e) => e.target.select()} placeholder="Referencia, contraparte o detalle de la operacion" />
      </div>
      <button className="btn btn-primary" onClick={handleSaveTransaction}>
        <CheckCircle style={{ width: '1rem', height: '1rem' }} />
        Registrar Movimiento
      </button>

      <div className="ledger-container">
        <div className="ledger-filter-row">
          <h3 className="card-title" style={{ fontSize: '1.05rem', marginBottom: 0 }}>Historial de Movimientos</h3>
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'nowrap', alignItems: 'center' }}>
            <select className="form-input" style={{ width: 'auto', minWidth: '180px' }} value={ledgerWalletFilter} onChange={(e) => setLedgerWalletFilter(e.target.value)}>
              <option value="">Todas las billeteras</option>
              {wallets.map(wallet => (
                <option key={wallet.id} value={wallet.id}>{wallet.name}</option>
              ))}
            </select>
            <select className="form-input" style={{ width: 'auto', minWidth: '120px' }} value={ledgerLimit} onChange={(e) => setLedgerLimit(e.target.value)}>
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
                  <td colSpan={8} style={{ textAlign: 'center', color: 'var(--text-muted)' }}>Sin movimientos registrados.</td>
                </tr>
              ) : (
                displayedTransactions.map(tx => (
                  <tr key={tx.id}>
                    <td>{new Date(tx.date).toLocaleString()}</td>
                    <td><span className={`tx-badge ${tx.type.toLowerCase().replace('_p2p', '')}`}>{tx.type.replace('_P2P', '')}</span></td>
                    <td>
                      <div className="tx-route-col">
                        <span>{tx.wallet_from_name || 'Externo'}</span>
                        <ArrowRight className="tx-route-arrow" style={{ width: '0.9rem', height: '0.9rem' }} />
                        <span>{tx.wallet_to_name || 'Externo'}</span>
                      </div>
                    </td>
                    <td className="tx-amount-out">-{tx.amount_out.toFixed(2)} {tx.wallet_from_currency || ''}</td>
                    <td className="tx-amount-in">+{tx.amount_in.toFixed(2)} {tx.wallet_to_currency || ''}</td>
                    <td>{tx.rate.toFixed(4)}</td>
                    <td>{tx.commission_pct.toFixed(2)}%</td>
                    <td>
                      <button className="btn btn-danger" style={{ padding: '0.3rem' }} onClick={() => handleDeleteTransaction(tx)} title="Eliminar">
                        <Trash2 style={{ width: '0.85rem', height: '0.85rem' }} />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
