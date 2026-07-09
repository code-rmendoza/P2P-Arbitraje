interface CloseOperativeModalProps {
  isOpen: boolean;
  onClose: () => void;
  date: string;
  setDate: (v: string) => void;
  notes: string;
  setNotes: (v: string) => void;
  accumulate: boolean;
  setAccumulate: (v: boolean) => void;
  volume: number;
  profit: number;
  metodoCompra: string;
  metodoVenta: string;
  onSave: () => void;
}

export function CloseOperativeModal({
  isOpen, onClose,
  date, setDate,
  notes, setNotes,
  accumulate, setAccumulate,
  volume, profit,
  metodoCompra, metodoVenta,
  onSave,
}: CloseOperativeModalProps) {
  if (!isOpen) return null;
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <h3 className="modal-header">Cerrar Operativa en Bitacora</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '1.5rem' }}>
          <div className="form-group">
            <label className="form-label">Fecha de Registro</label>
            <input type="date" className="form-input" value={date} onChange={(e) => setDate(e.target.value)} onFocus={(e) => e.target.select()} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div className="form-group">
              <label className="form-label">Volumen Total (USDT)</label>
              <input type="number" className="form-input" value={volume} disabled />
            </div>
            <div className="form-group">
              <label className="form-label">Ganancia Total (USDT)</label>
              <input type="number" className="form-input" value={profit.toFixed(2)} disabled />
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div className="form-group">
              <label className="form-label">Metodo Compra</label>
              <input type="text" className="form-input" value={metodoCompra} disabled />
            </div>
            <div className="form-group">
              <label className="form-label">Metodo Venta</label>
              <input type="text" className="form-input" value={metodoVenta} disabled />
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Notas</label>
            <textarea className="form-input" style={{ minHeight: '60px', resize: 'vertical' }} value={notes} onChange={(e) => setNotes(e.target.value)} onFocus={(e) => e.target.select()} />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <input type="checkbox" id="accumulate-check" checked={accumulate} onChange={(e) => setAccumulate(e.target.checked)} style={{ accentColor: 'var(--color-primary)' }} />
            <label htmlFor="accumulate-check" style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', cursor: 'pointer' }}>
              Acumular si ya existe registro de igual metodo
            </label>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
          <button className="btn btn-secondary" onClick={onClose}>Cancelar</button>
          <button className="btn btn-primary" onClick={onSave}>Registrar Cierre</button>
        </div>
      </div>
    </div>
  );
}
