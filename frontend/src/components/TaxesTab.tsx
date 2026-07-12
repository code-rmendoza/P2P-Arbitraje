import { DollarSign, Info, RefreshCw, CheckCircle, TrendingDown, TrendingUp } from 'lucide-react';
import type { DailyLog, Transaction } from '../api';
import { formatNumber } from '../utils/currency';

interface TaxesTabProps {
  year: number;
  tasaBcv: number;
  setTasaBcv: (v: number) => void;
  valorUt: number;
  setValorUt: (v: number) => void;
  isFetchingBcv: boolean;
  onFetchBcvRate: () => void;
  logs: DailyLog[];
  transactions: Transaction[];
}

export function TaxesTab({
  year,
  tasaBcv, setTasaBcv,
  valorUt, setValorUt,
  isFetchingBcv,
  onFetchBcvRate,
  logs,
  transactions,
}: TaxesTabProps) {
  const currentYearFiscalLogs = logs.filter(log => {
    const d = new Date(log.date + 'T00:00:00');
    return d.getFullYear() === year && log.tipo_operativa === 'VES';
  });

  const yearProfitUsdt = currentYearFiscalLogs.reduce((sum, log) => sum + log.profit, 0);
  const p2pProfitVes = yearProfitUsdt * tasaBcv;

  // Filtrar transacciones del año seleccionado
  const currentYearTransactions = transactions.filter(tx => {
    const d = new Date(tx.date);
    return d.getFullYear() === year;
  });

  // Helper para convertir transacción a VES
  const convertTxToVes = (tx: Transaction, amount: number, walletCurrency: string | null | undefined): number => {
    if (walletCurrency === 'VES') return amount;
    const rate = tx.rate > 0 ? tx.rate : tasaBcv;
    return amount * rate;
  };

  // Calcular ingresos y gastos deducibles
  const expensesByCategory: Record<string, number> = {};
  let totalExpensesVes = 0;
  const incomesByCategory: Record<string, number> = {};
  let totalIncomesVes = 0;

  currentYearTransactions.forEach(tx => {
    if (tx.type === 'GASTO') {
      const vesAmount = convertTxToVes(tx, tx.amount_out, tx.wallet_from_currency);
      totalExpensesVes += vesAmount;
      const cat = tx.category || 'Otros Gastos';
      expensesByCategory[cat] = (expensesByCategory[cat] || 0) + vesAmount;
    } else if (tx.type === 'INGRESO_EXTERNO') {
      const vesAmount = convertTxToVes(tx, tx.amount_in, tx.wallet_to_currency);
      totalIncomesVes += vesAmount;
      const cat = tx.category || 'Otros Ingresos No P2P';
      incomesByCategory[cat] = (incomesByCategory[cat] || 0) + vesAmount;
    }
  });

  // Base gravable real (no puede ser menor a 0 a efectos de cálculo de impuestos)
  const baseImponibleVes = p2pProfitVes + totalIncomesVes - totalExpensesVes;
  const profitInBoli = baseImponibleVes > 0 ? baseImponibleVes : 0;
  const profitInUt = valorUt > 0 ? profitInBoli / valorUt : 0;

  const islrBrackets = [
    { limitUt: 1000, rate: 0.06, sustraendoUt: 0, label: 'Hasta 1.000 UT' },
    { limitUt: 1500, rate: 0.09, sustraendoUt: 30, label: '1.000,01 - 1.500 UT' },
    { limitUt: 2000, rate: 0.12, sustraendoUt: 75, label: '1.500,01 - 2.000 UT' },
    { limitUt: 2500, rate: 0.16, sustraendoUt: 155, label: '2.000,01 - 2.500 UT' },
    { limitUt: 3000, rate: 0.20, sustraendoUt: 255, label: '2.500,01 - 3.000 UT' },
    { limitUt: 4000, rate: 0.24, sustraendoUt: 375, label: '3.000,01 - 4.000 UT' },
    { limitUt: 6000, rate: 0.29, sustraendoUt: 575, label: '4.000,01 - 6.000 UT' },
    { limitUt: Infinity, rate: 0.34, sustraendoUt: 875, label: '6.000,01 en adelante' },
  ];

  let activeBracketIndex = 0;
  for (let i = 0; i < islrBrackets.length; i++) {
    if (profitInUt <= islrBrackets[i].limitUt) {
      activeBracketIndex = i;
      break;
    }
  }

  const activeBracket = islrBrackets[activeBracketIndex];
  const isBelowDeclaringLimit = profitInUt < 1000;

  let taxOwedUt = 0;
  if (!isBelowDeclaringLimit) {
    taxOwedUt = (profitInUt * activeBracket.rate) - activeBracket.sustraendoUt;
    if (taxOwedUt < 0) taxOwedUt = 0;
  }

  const taxOwedBoli = taxOwedUt * valorUt;
  const taxOwedUsdt = tasaBcv > 0 ? taxOwedBoli / tasaBcv : 0;

  const usdOnlyLogs = logs.filter(log => {
    const d = new Date(log.date + 'T00:00:00');
    return d.getFullYear() === year && log.tipo_operativa === 'USD';
  });
  const yearUsdProfitTotal = usdOnlyLogs.reduce((sum, log) => sum + log.profit, 0);

  return (
    <div className="card">
      <div className="card-title">
        <DollarSign className="logo-icon" style={{ width: '1.5rem', height: '1.5rem', color: 'var(--color-primary)' }} />
        Estimacion Fiscal {year} — Venezuela ISLR
      </div>
      <div className="card-subtitle">
        Calculo anualizado estimado del Impuesto Sobre La Renta para el comercio P2P de criptoactivos en Venezuela.
        <span style={{ color: 'var(--color-primary)', fontWeight: 600 }}> (Solo incluye operaciones en VES)</span>
      </div>

      <div className="fiscal-header">
        <div className="fiscal-inputs">
          <div className="fiscal-select-wrapper">
            <span className="calendar-stat-label" style={{ alignSelf: 'flex-start', marginBottom: '0.2rem' }}>Pais / Sistema</span>
            <select className="fiscal-select">
              <option value="venezuela">Venezuela — ISLR</option>
            </select>
          </div>
          <div className="form-group" style={{ gap: '0.2rem' }}>
            <span className="calendar-stat-label">Tasa BCV (Bs./USDT)</span>
            <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
              <input type="number" className="form-input" style={{ padding: '0.4rem 0.75rem', fontSize: '0.85rem', width: '110px', fontWeight: 600 }} value={tasaBcv} onChange={(e) => setTasaBcv(parseFloat(e.target.value) || 0)} onFocus={(e) => e.target.select()} step="0.01" min="0.01" />
              <button className="btn btn-secondary" onClick={onFetchBcvRate} disabled={isFetchingBcv} title="Actualizar tasa desde el BCV" style={{ padding: '0.4rem 0.6rem', display: 'flex', alignItems: 'center', justifyContent: 'center', height: '31px', minWidth: '36px' }}>
                <RefreshCw style={{ width: '0.9rem', height: '0.9rem' }} className={isFetchingBcv ? 'spin-animation' : ''} />
              </button>
            </div>
          </div>
          <div className="form-group" style={{ gap: '0.2rem' }}>
            <span className="calendar-stat-label">Valor UT (Bs./UT)</span>
            <input type="number" className="form-input" style={{ padding: '0.4rem 0.75rem', fontSize: '0.85rem', width: '110px', fontWeight: 600 }} value={valorUt} onChange={(e) => setValorUt(parseFloat(e.target.value) || 0)} onFocus={(e) => e.target.select()} step="0.1" min="0.01" />
          </div>
        </div>
        <div className="calendar-stat-item">
          <span className="calendar-stat-label">Base Imponible Neto (VES)</span>
          <span className="calendar-stat-value profit" style={{ fontSize: '1.5rem', color: baseImponibleVes >= 0 ? 'var(--color-success)' : 'var(--color-danger)' }}>
            Bs. {formatNumber(profitInBoli)}
          </span>
        </div>
      </div>

      {isBelowDeclaringLimit ? (
        <div className="fiscal-alert success">
          <Info style={{ width: '1.25rem', height: '1.25rem', flexShrink: 0 }} />
          <div>
            <strong>Bajo el mínimo de 1.000 UT — No obligado a pagar ISLR.</strong> Tus ingresos netos gravables de <strong>{formatNumber(profitInUt)} UT</strong> están por debajo del límite mínimo establecido de 1,000 UT. No estás obligado a pagar impuesto de renta, pero debes declarar según la Tarifa Nº 1.
          </div>
        </div>
      ) : (
        <div className="fiscal-alert warning">
          <Info style={{ width: '1.25rem', height: '1.25rem', flexShrink: 0 }} />
          <div>
            <strong>Obligación de Declaración y Pago Activa.</strong> Tus ingresos netos gravables de <strong>{formatNumber(profitInUt)} UT</strong> exceden las 1,000 UT anuales. Debes presentar tu declaración estimada y definitiva de ISLR.
          </div>
        </div>
      )}

      <div className="metrics-grid" style={{ marginBottom: '1.5rem' }}>
        <div className="metric-card success">
          <div className="metric-label">Ganancia P2P</div>
          <div className="metric-value">Bs. {formatNumber(p2pProfitVes)}</div>
          <div className="metric-desc">Acumulado P2P (${formatNumber(yearProfitUsdt)} USDT)</div>
        </div>
        <div className="metric-card success" style={{ borderLeft: '4px solid var(--color-success)' }}>
          <div className="metric-label">Otros Ingresos</div>
          <div className="metric-value">Bs. {formatNumber(totalIncomesVes)}</div>
          <div className="metric-desc">Ingresos no P2P / Ext.</div>
        </div>
        <div className="metric-card warning" style={{ borderLeft: '4px solid var(--color-danger)' }}>
          <div className="metric-label" style={{ color: 'var(--color-danger)' }}>Gastos Operativos</div>
          <div className="metric-value" style={{ color: 'var(--color-danger)' }}>
            Bs. {formatNumber(totalExpensesVes)}
          </div>
          <div className="metric-desc">Costos deducibles del año</div>
        </div>
        <div className="metric-card accent">
          <div className="metric-label">Base Gravable UT</div>
          <div className="metric-value">{formatNumber(profitInUt)} UT</div>
          <div className="metric-desc">Valor UT de referencia: Bs. {formatNumber(valorUt)}</div>
        </div>
      </div>

      <div className="metrics-grid" style={{ marginBottom: '1.5rem', gridTemplateColumns: '1fr' }}>
        <div className="metric-card warning" style={{ borderLeft: '4px solid var(--color-danger)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div className="metric-label" style={{ color: 'var(--color-danger)', fontSize: '0.9rem' }}>Impuesto ISLR Estimado a Pagar</div>
            <div className="metric-desc">Bs. {formatNumber(taxOwedBoli)} (~{formatNumber(taxOwedUt, 1)} UT) a tasa del {((activeBracket?.rate || 0) * 100).toFixed(0)}%</div>
          </div>
          <div className="metric-value" style={{ color: 'var(--color-danger)', fontSize: '2rem' }}>
            ${formatNumber(taxOwedUsdt)}
            <span style={{ fontSize: '0.9rem', marginLeft: '0.25rem', fontWeight: 500 }}>USDT</span>
          </div>
        </div>
      </div>

      {/* Desglose de Gastos e Ingresos por Categoría */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
        <div className="card" style={{ padding: '1.25rem', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', backgroundColor: 'var(--bg-card)' }}>
          <h4 className="card-title" style={{ fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem', color: 'var(--text-color)' }}>
            <TrendingUp style={{ width: '1.1rem', height: '1.1rem', color: 'var(--color-success)' }} />
            Ingresos Adicionales
          </h4>
          {Object.keys(incomesByCategory).length === 0 ? (
            <div className="text-muted" style={{ fontSize: '0.85rem' }}>No hay otros ingresos registrados este año.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {Object.entries(incomesByCategory).map(([cat, val]) => (
                <div key={cat} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.25rem' }}>
                  <span>{cat}</span>
                  <span style={{ fontWeight: 600, color: 'var(--color-success)' }}>+Bs. {formatNumber(val)}</span>
                </div>
              ))}
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem', fontWeight: 700, marginTop: '0.5rem', paddingTop: '0.5rem', borderTop: '1px dashed var(--border-color)' }}>
                <span>Total Ingresos Extra</span>
                <span>Bs. {formatNumber(totalIncomesVes)}</span>
              </div>
            </div>
          )}
        </div>

        <div className="card" style={{ padding: '1.25rem', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', backgroundColor: 'var(--bg-card)' }}>
          <h4 className="card-title" style={{ fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem', color: 'var(--text-color)' }}>
            <TrendingDown style={{ width: '1.1rem', height: '1.1rem', color: 'var(--color-danger)' }} />
            Gastos y Costos Deducibles
          </h4>
          {Object.keys(expensesByCategory).length === 0 ? (
            <div className="text-muted" style={{ fontSize: '0.85rem' }}>No hay gastos operativos registrados este año.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {Object.entries(expensesByCategory).map(([cat, val]) => (
                <div key={cat} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.25rem' }}>
                  <span>{cat}</span>
                  <span style={{ fontWeight: 600, color: 'var(--color-danger)' }}>-Bs. {formatNumber(val)}</span>
                </div>
              ))}
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem', fontWeight: 700, marginTop: '0.5rem', paddingTop: '0.5rem', borderTop: '1px dashed var(--border-color)' }}>
                <span>Total Deducciones</span>
                <span>Bs. {formatNumber(totalExpensesVes)}</span>
              </div>
            </div>
          )}
        </div>
      </div>

      <div style={{ padding: '0.85rem 1.25rem', backgroundColor: 'rgba(37, 99, 235, 0.05)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span>
          <CheckCircle style={{ width: '1rem', height: '1rem', display: 'inline', color: 'var(--color-primary)', marginRight: '0.5rem', verticalAlign: 'text-bottom' }} />
          <strong>Separación de Carteras:</strong> El sistema detectó <strong>${formatNumber(yearUsdProfitTotal)} USDT</strong> de ganancias puras en USD (Zinli, Wally) que <strong>fueron excluidas</strong> del cálculo del impuesto venezolano.
        </span>
        <span style={{ fontWeight: 700, color: 'var(--color-primary)' }}>Excluido: ${formatNumber(yearUsdProfitTotal)} USD</span>
      </div>

      <h3 className="card-title" style={{ fontSize: '1.05rem', borderTop: '1px solid var(--border-color)', paddingTop: '1.5rem', marginBottom: '1rem' }}>
        Tarifa N 1 SENIAT (Personas Naturales Residentes)
      </h3>

      <div className="table-responsive">
        <table className="custom-table">
          <thead>
            <tr>
              <th>Fraccion de Renta (UT)</th>
              <th>Alicuota / Tasa (%)</th>
              <th>Sustraendo (UT)</th>
              <th>Estado</th>
            </tr>
          </thead>
          <tbody>
            {islrBrackets.map((bracket, idx) => {
              const isActive = idx === activeBracketIndex;
              return (
                <tr key={idx} className={isActive ? 'fiscal-bracket-row active-bracket' : ''}>
                  <td>{bracket.label}</td>
                  <td style={{ fontWeight: 700 }}>{(bracket.rate * 100).toFixed(0)}%</td>
                  <td>{bracket.sustraendoUt} UT</td>
                  <td>
                    {isActive ? (
                      <span style={{
                        backgroundColor: isBelowDeclaringLimit ? 'var(--color-success-light)' : 'rgba(239, 68, 68, 0.1)',
                        color: isBelowDeclaringLimit ? 'var(--color-success-hover)' : 'var(--color-danger)',
                        padding: '0.2rem 0.5rem',
                        borderRadius: '9999px',
                        fontSize: '0.75rem',
                        fontWeight: 700,
                      }}>
                        {isBelowDeclaringLimit ? 'ACTIVO (EXENTO)' : 'ACTIVO (SUJETO)'}
                      </span>
                    ) : (
                      <span style={{ color: 'var(--text-muted-light)', fontSize: '0.75rem' }}>-</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
