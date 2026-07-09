import { TrendingUp } from 'lucide-react';
import { calculateTargetBuyPrices } from '../api';

interface BuyPricesTabProps {
  precioVenta: number;
  setPrecioVenta: (v: number) => void;
  comisionP2P: number;
  setComisionP2P: (v: number) => void;
  percentPersonalizado: number;
  setPercentPersonalizado: (v: number) => void;
}

export function BuyPricesTab({
  precioVenta, setPrecioVenta,
  comisionP2P, setComisionP2P,
  percentPersonalizado, setPercentPersonalizado,
}: BuyPricesTabProps) {
  const buyTargets = calculateTargetBuyPrices(precioVenta, comisionP2P, percentPersonalizado);

  return (
    <div className="card">
      <div className="card-title">
        <TrendingUp className="logo-icon" style={{ width: '1.5rem', height: '1.5rem' }} />
        Calculadora de Precios de Compra P2P
      </div>
      <div className="card-subtitle">
        A partir de tu precio de venta y comision, calcula los precios maximos a los que debes comprar para asegurar un margen de ganancia.
      </div>

      <div className="form-grid" style={{ gridTemplateColumns: '1fr 1fr 1fr' }}>
        <div className="form-group">
          <label className="form-label">Precio de Venta</label>
          <input type="number" className="form-input" value={precioVenta} onChange={(e) => setPrecioVenta(parseFloat(e.target.value) || 0)} onFocus={(e) => e.target.select()} step="0.001" min="0" />
        </div>
        <div className="form-group">
          <label className="form-label">Comision P2P %</label>
          <input type="number" className="form-input" value={comisionP2P} onChange={(e) => setComisionP2P(parseFloat(e.target.value) || 0)} onFocus={(e) => e.target.select()} step="0.05" min="0" />
        </div>
        <div className="form-group">
          <label className="form-label">% Personalizado Objetivo</label>
          <div className="input-wrapper">
            <span className="input-prefix">%</span>
            <input type="number" className="form-input" value={percentPersonalizado} onChange={(e) => setPercentPersonalizado(parseFloat(e.target.value) || 0)} onFocus={(e) => e.target.select()} step="0.1" min="0" />
          </div>
        </div>
      </div>

      <h3 className="card-title" style={{ fontSize: '1.05rem', borderTop: '1px solid var(--border-color)', paddingTop: '1.5rem', marginBottom: '1rem' }}>
        Precios de Compra Objetivos
      </h3>

      <div className="buy-prices-container">
        {buyTargets.map((target, index) => {
          const isBreakeven = target.label === 'Breakeven';
          const isCustom = target.label === '% Personalizado';

          return (
            <div key={index} className={`buy-price-item ${isBreakeven ? 'breakeven' : ''} ${isCustom ? 'custom-highlight' : ''}`}>
              <div className="buy-price-label-group">
                <span className="buy-price-percent">{target.percentage} Ganancia</span>
                <span className="buy-price-label">
                  {isBreakeven ? 'Punto de Equilibrio (Breakeven)' : isCustom ? 'Margen Personalizado Ajustado' : `Margen de Ganancia del ${target.label}`}
                </span>
              </div>
              <div className="buy-price-value">{target.buyPrice.toFixed(3)}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
