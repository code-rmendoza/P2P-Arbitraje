import { CheckCircle } from 'lucide-react';
import type { Wallet } from '../api';
import { formatNumber } from '../utils/currency';

interface TransactionFormProps {
  txWalletFrom: string;
  setTxWalletFrom: (v: string) => void;
  txWalletTo: string;
  setTxWalletTo: (v: string) => void;
  txTypeOverride: string;
  setTxTypeOverride: (v: string) => void;
  transactionType: string;
  txCategory: string;
  setTxCategory: (v: string) => void;
  txDate: string;
  setTxDate: (v: string) => void;
  txAmountOut: number;
  setTxAmountOut: (v: number) => void;
  txRate: number;
  setTxRate: (v: number) => void;
  txCommission: number;
  setTxCommission: (v: number) => void;
  txManualAmountIn: string;
  setTxManualAmountIn: (v: string) => void;
  txAmountInDisplay: string;
  txNotes: string;
  setTxNotes: (v: string) => void;
  activeWallets: Wallet[];
  selectedWalletFrom?: Wallet;
  selectedWalletTo?: Wallet;
  handleSaveTransaction: () => void;
}

export function TransactionForm({
  txWalletFrom, setTxWalletFrom,
  txWalletTo, setTxWalletTo,
  txTypeOverride, setTxTypeOverride,
  transactionType,
  txCategory, setTxCategory,
  txDate, setTxDate,
  txAmountOut, setTxAmountOut,
  txRate, setTxRate,
  txCommission, setTxCommission,
  txManualAmountIn, setTxManualAmountIn,
  txAmountInDisplay,
  txNotes, setTxNotes,
  activeWallets,
  selectedWalletFrom,
  selectedWalletTo,
  handleSaveTransaction,
}: TransactionFormProps) {
  return (
    <>
      <h3 className="card-title margin-bottom-1rem">Registrar Movimiento</h3>
      <div className="form-grid select-filter-auto">
        <div className="form-group">
          <label className="form-label">Billetera Origen</label>
          <select className="form-input" value={txWalletFrom} onChange={(e) => setTxWalletFrom(e.target.value)}>
            <option value="">Externo / Deposito</option>
            {activeWallets.map(wallet => (
              <option key={wallet.id} value={wallet.id}>{wallet.name} - {formatNumber(wallet.balance)} {wallet.currency}</option>
            ))}
          </select>
        </div>
        <div className="form-group">
          <label className="form-label">Billetera Destino</label>
          <select className="form-input" value={txWalletTo} onChange={(e) => setTxWalletTo(e.target.value)}>
            <option value="">Externo / Retiro</option>
            {activeWallets.map(wallet => (
              <option key={wallet.id} value={wallet.id}>{wallet.name} - {wallet.currency}</option>
            ))}
          </select>
        </div>
        <div className="form-group">
          <label className="form-label">Tipo</label>
          <select className="form-input" value={txTypeOverride} onChange={(e) => setTxTypeOverride(e.target.value)}>
            <option value="AUTO">Auto: {transactionType}</option>
            <option value="VENTA_P2P">VENTA_P2P</option>
            <option value="COMPRA_P2P">COMPRA_P2P</option>
            <option value="DEPOSITO">DEPOSITO</option>
            <option value="RETIRO">RETIRO</option>
            <option value="TRANSFERENCIA">TRANSFERENCIA</option>
            <option value="GASTO">GASTO OPERATIVO</option>
            <option value="INGRESO_EXTERNO">INGRESO NO P2P</option>
          </select>
        </div>
        {['GASTO', 'INGRESO_EXTERNO'].includes(transactionType) && (
          <div className="form-group">
            <label className="form-label">Categoría Contable</label>
            <select className="form-input" value={txCategory} onChange={(e) => setTxCategory(e.target.value)}>
              <option value="">Seleccionar categoría...</option>
              {transactionType === 'GASTO' ? (
                <>
                  <option value="Comisiones Bancarias">Comisiones Bancarias</option>
                  <option value="Servicios (Internet/Luz/Teléfono)">Servicios (Internet/Luz/Teléfono)</option>
                  <option value="Alquiler / Oficina">Alquiler / Oficina</option>
                  <option value="Equipos / Hardware">Equipos / Hardware</option>
                  <option value="Impuestos / Tasas">Impuestos / Tasas</option>
                  <option value="Otros Gastos">Otros Gastos</option>
                </>
              ) : (
                <>
                  <option value="Servicios Profesionales">Servicios Profesionales</option>
                  <option value="Ventas Varias">Ventas Varias</option>
                  <option value="Otros Ingresos No P2P">Otros Ingresos No P2P</option>
                </>
              )}
            </select>
          </div>
        )}
        <div className="form-group">
          <label className="form-label">Fecha de Operacion</label>
          <input type="datetime-local" className="form-input input-date-compact" value={txDate} onChange={(e) => setTxDate(e.target.value)} />
        </div>
      </div>

      <div className="form-grid">
        <div className="form-group">
          <label className="form-label">Monto que sale <span className="suffix">{selectedWalletFrom?.currency || 'Origen'}</span></label>
          <input type="number" className="form-input" value={txAmountOut} onChange={(e) => setTxAmountOut(parseFloat(e.target.value) || 0)} onFocus={(e) => e.target.select()} min="0" step="0.01" />
        </div>
        <div className="form-group">
          <label className="form-label">Tasa</label>
          <input type="number" className="form-input" value={txRate} onChange={(e) => setTxRate(parseFloat(e.target.value) || 0)} onFocus={(e) => e.target.select()} min="0" step="0.001" />
        </div>
        <div className="form-group">
          <label className="form-label">Comision %</label>
          <input type="number" className="form-input" value={txCommission} onChange={(e) => setTxCommission(parseFloat(e.target.value) || 0)} onFocus={(e) => e.target.select()} min="0" step="0.05" />
        </div>
        <div className="form-group">
          <label className="form-label">Monto que entra <span className="suffix">{selectedWalletTo?.currency || 'Destino'}</span></label>
          <input type="number" className="form-input" value={txManualAmountIn || txAmountInDisplay} onChange={(e) => setTxManualAmountIn(e.target.value)} onFocus={(e) => e.target.select()} min="0" step="0.001" />
          <span className="metric-desc">Sugerido: {txAmountInDisplay} {selectedWalletTo?.currency || ''}</span>
        </div>
      </div>

      <div className="form-group margin-bottom-1rem">
        <label className="form-label">Notas</label>
        <input className="form-input" value={txNotes} onChange={(e) => setTxNotes(e.target.value)} onFocus={(e) => e.target.select()} placeholder="Referencia, contraparte o detalle de la operacion" />
      </div>
      <button className="btn btn-primary" onClick={handleSaveTransaction}>
        <CheckCircle className="icon-large" />
        Registrar Movimiento
      </button>
    </>
  );
}
