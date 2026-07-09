import { History, Info, Trash2 } from 'lucide-react';
import type { SavedCalculation } from '../api';

interface HistorySidebarProps {
  history: SavedCalculation[];
  capital: number;
  comisionCompra: number;
  comisionVenta: number;
  tasaVenta: number;
  tasaCompra: number;
  ciclosDia: number;
  onLoad: (sim: SavedCalculation) => void;
  onDelete: (id: number) => void;
}

export function HistorySidebar({
  history, capital, comisionCompra, comisionVenta, tasaVenta, tasaCompra, ciclosDia,
  onLoad, onDelete,
}: HistorySidebarProps) {
  return (
    <div>
      <div className="history-section">
        <h3 className="card-title" style={{ fontSize: '1.15rem', marginBottom: '0.5rem' }}>
          <History style={{ width: '1.25rem', height: '1.25rem', color: 'var(--color-primary)' }} />
          Simulaciones Guardadas
        </h3>

        {history.length === 0 ? (
          <div className="empty-state">
            <Info className="empty-state-icon" />
            <div style={{ fontWeight: 600, fontSize: '0.95rem', marginBottom: '0.25rem' }}>Sin Historial</div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted-light)' }}>
              Las simulaciones que guardes se sincronizaran con SQLite.
            </div>
          </div>
        ) : (
          history.map(sim => {
            const isSelected = sim.capital === capital &&
              sim.comision_compra === comisionCompra &&
              sim.comision_venta === comisionVenta &&
              sim.tasa_venta === tasaVenta &&
              sim.tasa_compra === tasaCompra &&
              sim.ciclos_dia === ciclosDia;
            return (
              <div key={sim.id} className={`history-card ${isSelected ? 'active' : ''}`} onClick={() => onLoad(sim)}>
                <div className="history-card-header">
                  <span className="history-card-title">{sim.label}</span>
                  <span className="history-card-date">{new Date(sim.created_at).toLocaleDateString()}</span>
                </div>
                <div className="history-card-metrics">
                  <div className="history-metric-item">
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted-light)' }}>CAPITAL</span>
                    <span className="history-metric-val">${sim.capital.toFixed(0)} USDT</span>
                  </div>
                  <div className="history-metric-item">
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted-light)' }}>GANANCIA</span>
                    <span className="history-metric-val profit">+{sim.ganancia_porcentaje.toFixed(2)}%</span>
                  </div>
                  <div className="history-metric-item">
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted-light)' }}>TIPO</span>
                    <span className="history-metric-val" style={{ fontWeight: 700 }}>{sim.tipo_operativa}</span>
                  </div>
                  <div className="history-metric-item">
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted-light)' }}>TASA COMPRA</span>
                    <span className="history-metric-val">{sim.tasa_compra.toFixed(3)}</span>
                  </div>
                </div>
                <div className="history-card-footer">
                  <button className="btn btn-danger" style={{ padding: '0.3rem 0.5rem', fontSize: '0.75rem' }}
                    onClick={(e) => { e.stopPropagation(); if (sim.id) onDelete(sim.id); }}>
                    <Trash2 style={{ width: '0.9rem', height: '0.9rem' }} />
                    Borrar
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
