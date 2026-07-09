import type { Wallet } from '../api';

interface WalletModalProps {
  isOpen: boolean;
  onClose: () => void;
  editingWallet: Wallet | null;
  walletForm: Omit<Wallet, 'id' | 'created_at'>;
  setWalletForm: (v: Omit<Wallet, 'id' | 'created_at'>) => void;
  onSave: () => void;
}

export function WalletModal({ isOpen, onClose, editingWallet, walletForm, setWalletForm, onSave }: WalletModalProps) {
  if (!isOpen) return null;
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <h3 className="modal-header">{editingWallet ? 'Editar Billetera' : 'Nueva Billetera'}</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '1.5rem' }}>
          <div className="form-group">
            <label className="form-label">Nombre</label>
            <input className="form-input" value={walletForm.name} onChange={(e) => setWalletForm({ ...walletForm, name: e.target.value })} onFocus={(e) => e.target.select()} placeholder="Binance USDT" autoFocus />
          </div>
          <div className="form-group">
            <label className="form-label">Plataforma</label>
            <input className="form-input" value={walletForm.platform} onChange={(e) => setWalletForm({ ...walletForm, platform: e.target.value })} onFocus={(e) => e.target.select()} placeholder="Binance, Zinli, Banesco" />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem' }}>
            <div className="form-group">
              <label className="form-label">Moneda</label>
              <select className="form-input" value={walletForm.currency} onChange={(e) => setWalletForm({ ...walletForm, currency: e.target.value as Wallet['currency'] })}>
                <option value="USDT">USDT</option>
                <option value="USD">USD</option>
                <option value="VES">VES</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Saldo actual</label>
              <input type="number" className="form-input" value={walletForm.balance} onChange={(e) => {
                const nextBalance = parseFloat(e.target.value) || 0;
                setWalletForm({ ...walletForm, balance: nextBalance, opening_balance: editingWallet ? walletForm.opening_balance : nextBalance });
              }} onFocus={(e) => e.target.select()} step="0.01" />
            </div>
            <div className="form-group">
              <label className="form-label">Capital inicial</label>
              <input type="number" className="form-input" value={walletForm.opening_balance} onChange={(e) => setWalletForm({ ...walletForm, opening_balance: parseFloat(e.target.value) || 0 })} onFocus={(e) => e.target.select()} step="0.01" />
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', alignItems: 'end' }}>
            <div className="form-group">
              <label className="form-label">Color</label>
              <input type="color" className="form-input" value={walletForm.color} onChange={(e) => setWalletForm({ ...walletForm, color: e.target.value })} style={{ height: '42px', padding: '0.2rem' }} />
            </div>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 600, color: 'var(--text-muted)' }}>
              <input type="checkbox" checked={walletForm.is_active} onChange={(e) => setWalletForm({ ...walletForm, is_active: e.target.checked })} style={{ accentColor: 'var(--color-primary)' }} />
              Activa
            </label>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
          <button className="btn btn-secondary" onClick={onClose}>Cancelar</button>
          <button className="btn btn-primary" onClick={onSave}>Guardar</button>
        </div>
      </div>
    </div>
  );
}
