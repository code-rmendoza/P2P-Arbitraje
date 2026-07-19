import { WalletCards, Plus, Trash2, FileDown } from 'lucide-react';
import type { Wallet, Transaction } from '../api';
import { exportPortfolioPDF } from '../api/pdf';
import { PortfolioKPIs } from './PortfolioKPIs';
import { ConsolidatedTable } from './ConsolidatedTable';
import { WalletsGrid } from './WalletsGrid';
import { TransactionForm } from './TransactionForm';
import { TransactionLedger } from './TransactionLedger';

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
  txCategory: string;
  setTxCategory: (v: string) => void;
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
  txCategory, setTxCategory,
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
        <WalletCards className="logo-icon icon-logo-size" />
        Portafolio & Libro Contable
      </div>
      <div className="card-header-actions">
        <div className="card-subtitle">
          Saldos reales por billetera y movimientos de doble entrada.
        </div>
        <div className="action-buttons-group">
          <button className="btn btn-secondary btn-icon-label" onClick={() => exportPortfolioPDF({
            wallets, transactions: displayedTransactions, totalUsdt: totalPortfolioUsdt,
            profitUsdt: realPortfolioProfitUsdt, profitPct: realPortfolioProfitPct, tasaBcv,
          })} title="Exportar portafolio a PDF">
            <FileDown className="icon-small" />
            Exportar PDF
          </button>
          <button className="btn btn-secondary btn-icon-label btn-danger-outline" onClick={handleResetSystem} title="Restablecer base de datos">
            <Trash2 className="icon-small" />
            Reiniciar Sistema
          </button>
          <span className="filter-label">Filtrar Periodo:</span>
          <select className="form-input select-filter-compact" value={portfolioDateFilter} onChange={(e) => setPortfolioDateFilter(e.target.value)}>
            <option value="today">Hoy</option>
            <option value="yesterday">Ayer</option>
            <option value="month">Este Mes</option>
            <option value="all">Historico General</option>
          </select>
        </div>
      </div>

      <PortfolioKPIs 
        totalPortfolioUsdt={totalPortfolioUsdt}
        realPortfolioProfitUsdt={realPortfolioProfitUsdt}
        realPortfolioProfitPct={realPortfolioProfitPct}
        groupedBalance={groupedBalance}
        tasaBcv={tasaBcv}
      />

      <ConsolidatedTable 
        profitRows={profitRows}
        totalPortfolioUsdt={totalPortfolioUsdt}
        totalOpeningUsdt={totalOpeningUsdt}
        totalDepositsUsdt={totalDepositsUsdt}
        totalWithdrawalsUsdt={totalWithdrawalsUsdt}
        realPortfolioProfitUsdt={realPortfolioProfitUsdt}
      />

      <div className="ledger-filter-row">
        <h3 className="card-title select-filter-limit">Billeteras</h3>
        <button className="btn btn-primary" onClick={() => handleOpenWalletModal()}>
          <Plus className="icon-large" />
          Agregar Billetera
        </button>
      </div>

      <WalletsGrid 
        wallets={wallets}
        portfolioStart={portfolioStart}
        portfolioEnd={portfolioEnd}
        filteredTransactionsForRange={filteredTransactionsForRange}
        getWalletBalancesForRange={getWalletBalancesForRange}
        handleOpenWalletModal={handleOpenWalletModal}
        handleDeactivateWallet={handleDeactivateWallet}
        handleDeleteWallet={handleDeleteWallet}
      />

      <div className="tx-separator"></div>

      <TransactionForm 
        txWalletFrom={txWalletFrom} setTxWalletFrom={setTxWalletFrom}
        txWalletTo={txWalletTo} setTxWalletTo={setTxWalletTo}
        txTypeOverride={txTypeOverride} setTxTypeOverride={setTxTypeOverride}
        transactionType={transactionType}
        txCategory={txCategory} setTxCategory={setTxCategory}
        txDate={txDate} setTxDate={setTxDate}
        txAmountOut={txAmountOut} setTxAmountOut={setTxAmountOut}
        txRate={txRate} setTxRate={setTxRate}
        txCommission={txCommission} setTxCommission={setTxCommission}
        txManualAmountIn={txManualAmountIn} setTxManualAmountIn={setTxManualAmountIn}
        txAmountInDisplay={txAmountInDisplay}
        txNotes={txNotes} setTxNotes={setTxNotes}
        activeWallets={activeWallets}
        selectedWalletFrom={selectedWalletFrom}
        selectedWalletTo={selectedWalletTo}
        handleSaveTransaction={handleSaveTransaction}
      />

      <TransactionLedger 
        wallets={wallets}
        displayedTransactions={displayedTransactions}
        ledgerWalletFilter={ledgerWalletFilter} setLedgerWalletFilter={setLedgerWalletFilter}
        ledgerLimit={ledgerLimit} setLedgerLimit={setLedgerLimit}
        handleDeleteTransaction={handleDeleteTransaction}
      />
    </div>
  );
}
