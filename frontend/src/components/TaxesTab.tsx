import { DollarSign, Info, RefreshCw, CheckCircle } from 'lucide-react';
import type { DailyLog } from '../api';

interface TaxesTabProps {
  year: number;
  tasaBcv: number;
  setTasaBcv: (v: number) => void;
  valorUt: number;
  setValorUt: (v: number) => void;
  isFetchingBcv: boolean;
  onFetchBcvRate: () => void;
  logs: DailyLog[];
}

export function TaxesTab({
  year,
  tasaBcv, setTasaBcv,
  valorUt, setValorUt,
  isFetchingBcv,
  onFetchBcvRate,
  logs,
}: TaxesTabProps) {
  const currentYearFiscalLogs = logs.filter(log => {
    const d = new Date(log.date + 'T00:00:00');
    return d.getFullYear() === year && log.tipo_operativa === 'VES';
  });

  const yearProfitUsdt = currentYearFiscalLogs.reduce((sum, log) => sum + log.profit, 0);
  const profitInBoli = yearProfitUsdt * tasaBcv;
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
          <span className="calendar-stat-label">Profit Gravable (VES)</span>
          <span className="calendar-stat-value profit" style={{ fontSize: '1.5rem' }}>
            +{yearProfitUsdt.toFixed(2)} USDT
          </span>
        </div>
      </div>

      {isBelowDeclaringLimit ? (
        <div className="fiscal-alert success">
          <Info style={{ width: '1.25rem', height: '1.25rem', flexShrink: 0 }} />
          <div>
            <strong>Bajo el minimo de 1.000 UT — No obligado a declarar.</strong> Tus ganancias totales anuales de <strong>{profitInUt.toFixed(2)} UT</strong> estan por debajo del limite minimo establecido de 1,000 UT. No estas legalmente obligado a realizar pago de ISLR segun la tarifa N 1.
          </div>
        </div>
      ) : (
        <div className="fiscal-alert warning">
          <Info style={{ width: '1.25rem', height: '1.25rem', flexShrink: 0 }} />
          <div>
            <strong>Obligacion de Declaracion Activa.</strong> Tus ingresos netos de <strong>{profitInUt.toFixed(2)} UT</strong> exceden las 1,000 UT anuales. Debes presentar tu declaracion estimada y definitiva de ISLR.
          </div>
        </div>
      )}

      <div className="metrics-grid" style={{ marginBottom: '1.5rem' }}>
        <div className="metric-card success">
          <div className="metric-label">Profit Real VES</div>
          <div className="metric-value">{yearProfitUsdt.toFixed(2)} USDT</div>
          <div className="metric-desc">Suma acumulada gravable del ano {year}</div>
        </div>
        <div className="metric-card accent">
          <div className="metric-label">En Bolivares</div>
          <div className="metric-value">Bs. {profitInBoli.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
          <div className="metric-desc">Tasa BCV de cambio: {tasaBcv} Bs/USDT</div>
        </div>
        <div className="metric-card success">
          <div className="metric-label">En Unidades Tributarias (UT)</div>
          <div className="metric-value">{profitInUt.toFixed(2)} UT</div>
          <div className="metric-desc">Valor UT de referencia: Bs. {valorUt}</div>
        </div>
        <div className="metric-card warning" style={{ borderLeft: '4px solid var(--color-danger)' }}>
          <div className="metric-label" style={{ color: 'var(--color-danger)' }}>ISLR Estimado a Pagar</div>
          <div className="metric-value" style={{ color: 'var(--color-danger)' }}>
            ${taxOwedUsdt.toFixed(2)}
            <span style={{ fontSize: '0.8rem', marginLeft: '0.25rem', fontWeight: 500 }}>USDT</span>
          </div>
          <div className="metric-desc">Bs. {taxOwedBoli.toFixed(2)} (~{taxOwedUt.toFixed(1)} UT)</div>
        </div>
      </div>

      <div style={{ padding: '0.85rem 1.25rem', backgroundColor: 'var(--bg-app)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span>
          <CheckCircle style={{ width: '1rem', height: '1rem', display: 'inline', color: 'var(--color-primary)', marginRight: '0.5rem', verticalAlign: 'text-bottom' }} />
          <strong>Separacion de Carteras:</strong> El sistema detecto <strong>${yearUsdProfitTotal.toFixed(2)} USDT</strong> de ganancias puras en USD (Zinli, Wally) que <strong>fueron excluidas</strong> de este calculo fiscal.
        </span>
        <span style={{ fontWeight: 700, color: 'var(--color-primary)' }}>Excluido: ${yearUsdProfitTotal.toFixed(2)} USD</span>
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
