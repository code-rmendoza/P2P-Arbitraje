import { Calculator, Plus, CheckCircle, Download } from 'lucide-react';
import type { CalculationResult } from '../api';

interface OperativeTabProps {
  tipoOperativa: string;
  setTipoOperativa: (v: string) => void;
  capital: number;
  setCapital: (v: number) => void;
  ciclosDia: number;
  setCiclosDia: (v: number) => void;
  plataformaCompra: string;
  setPlataformaCompra: (v: string) => void;
  metodoCompra: string;
  setMetodoCompra: (v: string) => void;
  tasaCompra: number;
  setTasaCompra: (v: number) => void;
  comisionCompra: number;
  setComisionCompra: (v: number) => void;
  plataformaVenta: string;
  setPlataformaVenta: (v: string) => void;
  metodoVenta: string;
  setMetodoVenta: (v: string) => void;
  tasaVenta: number;
  setTasaVenta: (v: number) => void;
  comisionVenta: number;
  setComisionVenta: (v: number) => void;
  calculationResult: CalculationResult;
  onOpenSaveModal: () => void;
  onOpenCloseOperative: () => void;
  onExport: () => void;
}

export function OperativeTab({
  tipoOperativa, setTipoOperativa,
  capital, setCapital,
  ciclosDia, setCiclosDia,
  plataformaCompra, setPlataformaCompra,
  metodoCompra, setMetodoCompra,
  tasaCompra, setTasaCompra,
  comisionCompra, setComisionCompra,
  plataformaVenta, setPlataformaVenta,
  metodoVenta, setMetodoVenta,
  tasaVenta, setTasaVenta,
  comisionVenta, setComisionVenta,
  calculationResult,
  onOpenSaveModal,
  onOpenCloseOperative,
  onExport,
}: OperativeTabProps) {
  return (
    <div className="card">
      <div className="card-title">
        <Calculator className="logo-icon" style={{ width: '1.5rem', height: '1.5rem' }} />
        Configuracion de Operativa
      </div>
      <div className="card-subtitle">
        Ajusta las variables de capital, tasas y ciclos para simular los rendimientos de tu arbitraje.
      </div>

      <div className="form-grid">
        <div className="form-group">
          <label className="form-label">Tipo de Operativa</label>
          <select className="form-input" value={tipoOperativa} onChange={(e) => setTipoOperativa(e.target.value)} style={{ fontWeight: 600 }}>
            <option value="USD">Operar en USD (Zinli, Wally, etc.)</option>
            <option value="VES">Operar en VES (Bancos locales)</option>
          </select>
        </div>
        <div className="form-group">
          <label className="form-label">Capital Inicial</label>
          <div className="input-wrapper">
            <span className="input-prefix">$</span>
            <input type="number" className="form-input" value={capital} onChange={(e) => setCapital(parseFloat(e.target.value) || 0)} onFocus={(e) => e.target.select()} step="50" min="0" />
          </div>
        </div>
        <div className="form-group">
          <label className="form-label">Ciclos al Dia</label>
          <select className="form-input" value={ciclosDia} onChange={(e) => setCiclosDia(parseInt(e.target.value) || 1)}>
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(val => (
              <option key={val} value={val}>{val} {val === 1 ? 'ciclo' : 'ciclos'}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="tx-separator" style={{ margin: '1rem 0' }}></div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.25rem', marginBottom: '1.25rem' }}>
        <div className="form-group">
          <label className="form-label" style={{ color: 'var(--color-primary)' }}>Plataforma Compra</label>
          <input type="text" className="form-input" value={plataformaCompra} onChange={(e) => setPlataformaCompra(e.target.value)} onFocus={(e) => e.target.select()} placeholder="Ej. Binance P2P" />
        </div>
        <div className="form-group">
          <label className="form-label" style={{ color: 'var(--color-primary)' }}>Metodo Compra (Billetera/Banco)</label>
          <input type="text" className="form-input" value={metodoCompra} onChange={(e) => setMetodoCompra(e.target.value)} onFocus={(e) => e.target.select()} placeholder="Ej. Zinli, Pago Movil" />
        </div>
        <div className="form-group">
          <label className="form-label" style={{ color: 'var(--color-primary)' }}>Tasa de Compra</label>
          <input type="number" className="form-input" value={tasaCompra} onChange={(e) => setTasaCompra(parseFloat(e.target.value) || 0)} onFocus={(e) => e.target.select()} step="0.001" min="0" />
        </div>
        <div className="form-group">
          <label className="form-label" style={{ color: 'var(--color-primary)' }}>Comision Compra P2P %</label>
          <input type="number" className="form-input" value={comisionCompra} onChange={(e) => setComisionCompra(parseFloat(e.target.value) || 0)} onFocus={(e) => e.target.select()} step="0.05" min="0" />
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.25rem', marginBottom: '1.25rem' }}>
        <div className="form-group">
          <label className="form-label" style={{ color: 'var(--color-accent)' }}>Plataforma Venta</label>
          <input type="text" className="form-input" value={plataformaVenta} onChange={(e) => setPlataformaVenta(e.target.value)} onFocus={(e) => e.target.select()} placeholder="Ej. Binance P2P" />
        </div>
        <div className="form-group">
          <label className="form-label" style={{ color: 'var(--color-accent)' }}>Metodo Venta (Billetera/Banco)</label>
          <input type="text" className="form-input" value={metodoVenta} onChange={(e) => setMetodoVenta(e.target.value)} onFocus={(e) => e.target.select()} placeholder="Ej. Zinli, Pago Movil" />
        </div>
        <div className="form-group">
          <label className="form-label" style={{ color: 'var(--color-accent)' }}>Tasa de Venta</label>
          <input type="number" className="form-input" value={tasaVenta} onChange={(e) => setTasaVenta(parseFloat(e.target.value) || 0)} onFocus={(e) => e.target.select()} step="0.001" min="0" />
        </div>
        <div className="form-group">
          <label className="form-label" style={{ color: 'var(--color-accent)' }}>Comision Venta P2P %</label>
          <input type="number" className="form-input" value={comisionVenta} onChange={(e) => setComisionVenta(parseFloat(e.target.value) || 0)} onFocus={(e) => e.target.select()} step="0.05" min="0" />
        </div>
      </div>

      <div className="metrics-grid">
        <div className="metric-card success">
          <div className="metric-label">Ganancia por Ciclo</div>
          <div className="metric-value">
            ${calculationResult.ganancia_ciclo.toFixed(2)}
            <span style={{ fontSize: '0.85rem', fontWeight: 500, color: 'var(--color-success-hover)', marginLeft: '0.35rem' }}>USDT</span>
          </div>
          <div className="metric-desc">Margenes netos por ciclo de arbitraje</div>
        </div>
        <div className="metric-card accent">
          <div className="metric-label">Porcentaje Ganancia</div>
          <div className="metric-value">{calculationResult.ganancia_porcentaje.toFixed(2)}%</div>
          <div className="metric-desc">Retorno por ciclo neto de comisiones</div>
        </div>
        <div className="metric-card success">
          <div className="metric-label">Ganancia Proyectada al Mes</div>
          <div className="metric-value">
            ${calculationResult.ganancia_mensual.toFixed(2)}
            <span style={{ fontSize: '0.85rem', fontWeight: 500, color: 'var(--color-success-hover)', marginLeft: '0.35rem' }}>USDT</span>
          </div>
          <div className="metric-desc">Proyectado a {ciclosDia} ciclos diarios (30 dias)</div>
        </div>
        <div className="metric-card warning">
          <div className="metric-label">Tasa Maxima Compra (Breakeven)</div>
          <div className="metric-value" style={{ color: 'var(--text-main)' }}>{calculationResult.tasa_minima_compra.toFixed(3)}</div>
          <div className="metric-desc">Tasa compra limite para no perder dinero</div>
        </div>
      </div>

      <h3 className="card-title" style={{ fontSize: '1.05rem', borderTop: '1px solid var(--border-color)', paddingTop: '1.5rem' }}>
        Detalle del Flujo de Operacion ({tipoOperativa})
      </h3>
      <div className="table-responsive">
        <table className="custom-table">
          <thead>
            <tr>
              <th>Paso</th>
              <th>Detalle de Operacion</th>
              <th>Tasa</th>
              <th>Monto Resultante</th>
              <th>Comision</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>1</td>
              <td style={{ fontWeight: 600 }}>Venta Lote Completo (USDT {'>>'} Fiat con {metodoVenta})</td>
              <td>{tasaVenta.toFixed(3)}</td>
              <td>{calculationResult.monto_venta.toFixed(2)} {tipoOperativa === 'VES' ? 'VES' : 'USD'}</td>
              <td>{comisionVenta.toFixed(2)}%</td>
            </tr>
            <tr>
              <td>2</td>
              <td style={{ fontWeight: 600 }}>Compra de USDT (Fiat {'>>'} USDT con {metodoCompra})</td>
              <td>{tasaCompra.toFixed(3)}</td>
              <td style={{ color: 'var(--color-success-hover)', fontWeight: 700 }}>{calculationResult.monto_compra.toFixed(2)} USDT</td>
              <td>{comisionCompra.toFixed(2)}%</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className="actions-row">
        <button className="btn btn-primary" onClick={onOpenSaveModal}>
          <Plus style={{ width: '1.1rem', height: '1.1rem' }} />
          Guardar Simulacion
        </button>
        <button className="btn btn-secondary" style={{ border: '1px solid var(--color-primary)', color: 'var(--color-primary)' }} onClick={onOpenCloseOperative}>
          <CheckCircle style={{ width: '1.1rem', height: '1.1rem' }} />
          Cerrar Operativa en Bitacora
        </button>
        <button className="btn btn-secondary" onClick={onExport}>
          <Download style={{ width: '1.1rem', height: '1.1rem' }} />
          Exportar Reporte
        </button>
      </div>
    </div>
  );
}
