import { ArrowRight, Trash2 } from 'lucide-react';
import type { DailyLog } from '../api';

interface LogDayModalProps {
  isOpen: boolean;
  onClose: () => void;
  dateStr: string | null;
  activeDayLogs: DailyLog[];
  newLogType: string;
  setNewLogType: (v: string) => void;
  newLogNotes: string;
  setNewLogNotes: (v: string) => void;
  newLogMetCompra: string;
  setNewLogMetCompra: (v: string) => void;
  newLogMetVenta: string;
  setNewLogMetVenta: (v: string) => void;
  newLogVolume: number;
  setNewLogVolume: (v: number) => void;
  newLogProfit: number;
  setNewLogProfit: (v: number) => void;
  onSave: () => void;
  onDeleteLog: (id: number) => void;
}

export function LogDayModal({
  isOpen, onClose, dateStr,
  activeDayLogs,
  newLogType, setNewLogType,
  newLogNotes, setNewLogNotes,
  newLogMetCompra, setNewLogMetCompra,
  newLogMetVenta, setNewLogMetVenta,
  newLogVolume, setNewLogVolume,
  newLogProfit, setNewLogProfit,
  onSave, onDeleteLog,
}: LogDayModalProps) {
  if (!isOpen || !dateStr) return null;
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" style={{ maxWidth: '550px' }} onClick={(e) => e.stopPropagation()}>
        <h3 className="modal-header">Bitacora: {dateStr}</h3>

        <h4 className="form-label" style={{ marginBottom: '0.5rem' }}>Operaciones Registradas ({activeDayLogs.length})</h4>
        {activeDayLogs.length === 0 ? (
          <div className="empty-state" style={{ padding: '1.5rem', marginBottom: '1.5rem' }}>
            <span style={{ fontSize: '0.8rem' }}>No hay operaciones registradas para este dia. Usa el formulario de abajo para agregar una.</span>
          </div>
        ) : (
          <div className="modal-tx-list">
            {activeDayLogs.map((log) => {
              const isUsd = log.tipo_operativa === 'USD';
              const badgeClass = isUsd ? 'badge-usd' : 'badge-ves';
              return (
                <div key={log.id} className="modal-tx-item">
                  <div className="modal-tx-details">
                    <div className="modal-tx-route">
                      <span>{log.metodo_compra}</span>
                      <ArrowRight style={{ width: '0.8rem', height: '0.8rem', color: 'var(--text-muted-light)' }} />
                      <span>{log.metodo_venta}</span>
                      <span className={`badge ${badgeClass}`} style={{ marginLeft: '0.5rem' }}>{log.tipo_operativa}</span>
                    </div>
                    <div className="modal-tx-meta">
                      <span className="badge badge-platform">{log.plataforma_compra} / {log.plataforma_venta}</span>
                      {log.notes && <span style={{ fontStyle: 'italic', maxWidth: '180px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={log.notes}>- {log.notes}</span>}
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center' }}>
                    <div className="modal-tx-amounts">
                      <span className={`modal-tx-profit ${log.profit >= 0 ? '' : 'negative'}`}>
                        {log.profit >= 0 ? '+' : ''}${log.profit.toFixed(2)}
                      </span>
                      <span className="modal-tx-vol">Vol: {log.volume.toFixed(2)}</span>
                    </div>
                    <div className="modal-tx-actions">
                      <button className="btn btn-danger" style={{ padding: '0.25rem 0.4rem', borderRadius: '4px' }}
                        onClick={() => log.id && onDeleteLog(log.id)} title="Eliminar operacion">
                        <Trash2 style={{ width: '0.8rem', height: '0.8rem' }} />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div className="tx-separator" style={{ margin: '1rem 0' }}></div>

        <h4 className="form-label" style={{ marginBottom: '0.75rem', color: 'var(--color-primary)' }}>
          Agregar Operacion Manual
        </h4>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1.5rem' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            <div className="form-group">
              <label className="form-label">Tipo Operativa</label>
              <select className="form-input" value={newLogType} onChange={(e) => setNewLogType(e.target.value)} style={{ padding: '0.4rem 0.75rem' }}>
                <option value="USD">USD (Zinli, Wally)</option>
                <option value="VES">VES (Banco locales)</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Notas</label>
              <input type="text" className="form-input" value={newLogNotes} onChange={(e) => setNewLogNotes(e.target.value)} onFocus={(e) => e.target.select()} placeholder="Nota rapida" style={{ padding: '0.4rem 0.75rem' }} />
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            <div className="form-group">
              <label className="form-label">Metodo Compra (Zinli, etc)</label>
              <input type="text" className="form-input" value={newLogMetCompra} onChange={(e) => setNewLogMetCompra(e.target.value)} onFocus={(e) => e.target.select()} style={{ padding: '0.4rem 0.75rem' }} />
            </div>
            <div className="form-group">
              <label className="form-label">Metodo Venta (Banesco, etc)</label>
              <input type="text" className="form-input" value={newLogMetVenta} onChange={(e) => setNewLogMetVenta(e.target.value)} onFocus={(e) => e.target.select()} style={{ padding: '0.4rem 0.75rem' }} />
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            <div className="form-group">
              <label className="form-label">Volumen (USDT)</label>
              <input type="number" className="form-input" value={newLogVolume} onChange={(e) => setNewLogVolume(parseFloat(e.target.value) || 0)} onFocus={(e) => e.target.select()} style={{ padding: '0.4rem 0.75rem' }} />
            </div>
            <div className="form-group">
              <label className="form-label">Profit (USDT)</label>
              <input type="number" className="form-input" value={newLogProfit} onChange={(e) => setNewLogProfit(parseFloat(e.target.value) || 0)} onFocus={(e) => e.target.select()} step="1" style={{ padding: '0.4rem 0.75rem' }} />
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
          <button className="btn btn-secondary" onClick={onClose}>Cerrar Ventana</button>
          <button className="btn btn-primary" onClick={onSave}>Anadir Operacion</button>
        </div>
      </div>
    </div>
  );
}
