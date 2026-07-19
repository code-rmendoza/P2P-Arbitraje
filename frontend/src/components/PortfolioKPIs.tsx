import { formatNumber } from '../utils/currency';

interface PortfolioKPIsProps {
  totalPortfolioUsdt: number;
  realPortfolioProfitUsdt: number;
  realPortfolioProfitPct: number;
  groupedBalance: (currency: 'USDT' | 'USD' | 'VES') => number;
  tasaBcv: number;
}

export function PortfolioKPIs({
  totalPortfolioUsdt,
  realPortfolioProfitUsdt,
  realPortfolioProfitPct,
  groupedBalance,
  tasaBcv,
}: PortfolioKPIsProps) {
  return (
    <div className="portfolio-kpi-row">
      <div className="metric-card success">
        <span className="metric-label">Total consolidado</span>
        <span className="metric-value">${formatNumber(totalPortfolioUsdt)}</span>
        <span className="metric-desc">Estimado en USDT usando USD 1:1 y BCV para VES</span>
      </div>
      <div className={`metric-card ${realPortfolioProfitUsdt >= 0 ? 'success' : ''}`}>
        <span className="metric-label">Profit real</span>
        <span className="metric-value" style={{ color: realPortfolioProfitUsdt >= 0 ? 'var(--color-success)' : 'var(--color-danger)' }}>
          {realPortfolioProfitUsdt >= 0 ? '+' : ''}${formatNumber(realPortfolioProfitUsdt)}
        </span>
        <span className="metric-desc">
          {realPortfolioProfitPct >= 0 ? '+' : ''}{formatNumber(realPortfolioProfitPct)}% sobre capital inicial
        </span>
      </div>
      <div className="metric-card">
        <span className="metric-label">USDT</span>
        <span className="metric-value">{formatNumber(groupedBalance('USDT'))}</span>
        <span className="metric-desc">Disponible en wallets cripto</span>
      </div>
      <div className="metric-card accent">
        <span className="metric-label">USD</span>
        <span className="metric-value">{formatNumber(groupedBalance('USD'))}</span>
        <span className="metric-desc">Zinli, Wally u otros saldos USD</span>
      </div>
      <div className="metric-card warning">
        <span className="metric-label">VES</span>
        <span className="metric-value">{formatNumber(groupedBalance('VES'))}</span>
        <span className="metric-desc">Equiv. ${(tasaBcv > 0 ? formatNumber(groupedBalance('VES') / tasaBcv) : '0.00')} USDT</span>
      </div>
    </div>
  );
}
