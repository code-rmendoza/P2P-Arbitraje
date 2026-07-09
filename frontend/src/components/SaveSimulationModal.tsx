interface SaveSimulationModalProps {
  isOpen: boolean;
  onClose: () => void;
  label: string;
  setLabel: (v: string) => void;
  onSave: () => void;
}

export function SaveSimulationModal({ isOpen, onClose, label, setLabel, onSave }: SaveSimulationModalProps) {
  if (!isOpen) return null;
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <h3 className="modal-header">Guardar Simulacion P2P</h3>
        <div className="form-group" style={{ marginBottom: '1.5rem' }}>
          <label className="form-label">Nombre de la Simulacion</label>
          <input type="text" className="form-input" value={label} onChange={(e) => setLabel(e.target.value)} onFocus={(e) => e.target.select()} placeholder="Ej. Binance ARS - Banco Galicia" autoFocus />
        </div>
        <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
          <button className="btn btn-secondary" onClick={onClose}>Cancelar</button>
          <button className="btn btn-primary" onClick={onSave}>Guardar en SQLite</button>
        </div>
      </div>
    </div>
  );
}
