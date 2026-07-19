import { formatNumber } from '../utils/currency';

interface ProfitRow {
  currency: 'USDT' | 'USD' | 'VES';
  current: number;
  opening: number;
  deposits: number;
  withdrawals: number;
  profit: number;
}

interface ConsolidatedTableProps {
  profitRows: ProfitRow[];
  totalPortfolioUsdt: number;
  totalOpeningUsdt: number;
  totalDepositsUsdt: number;
  totalWithdrawalsUsdt: number;
  realPortfolioProfitUsdt: number;
}

export function ConsolidatedTable({
  profitRows,
  totalPortfolioUsdt,
  totalOpeningUsdt,
  totalDepositsUsdt,
  totalWithdrawalsUsdt,
  realPortfolioProfitUsdt,
}: ConsolidatedTableProps) {
  return (
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
              <td>{formatNumber(row.current)}</td>
              <td>{formatNumber(row.opening)}</td>
              <td>{formatNumber(row.deposits)}</td>
              <td>{formatNumber(row.withdrawals)}</td>
              <td className={row.profit >= 0 ? 'tx-amount-in' : 'tx-amount-out'}>
                {row.profit >= 0 ? '+' : ''}{formatNumber(row.profit)} {row.currency}
              </td>
            </tr>
          ))}
          <tr>
            <td><strong>Total USDT</strong></td>
            <td>{formatNumber(totalPortfolioUsdt)}</td>
            <td>{formatNumber(totalOpeningUsdt)}</td>
            <td>{formatNumber(totalDepositsUsdt)}</td>
            <td>{formatNumber(totalWithdrawalsUsdt)}</td>
            <td className={realPortfolioProfitUsdt >= 0 ? 'tx-amount-in' : 'tx-amount-out'}>
              {realPortfolioProfitUsdt >= 0 ? '+' : ''}{formatNumber(realPortfolioProfitUsdt)} USDT
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
