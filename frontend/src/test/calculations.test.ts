import { describe, it, expect } from 'vitest';
import { performLocalCalculations, calculateTargetBuyPrices } from '../api/calculations';
import type { CalculationInput } from '../api/calculations';

describe('performLocalCalculations', () => {
  const baseInput: CalculationInput = {
    capital: 1000,
    tipo_operativa: 'USD',
    plataforma_compra: 'Binance P2P',
    plataforma_venta: 'Binance P2P',
    comision_compra: 0.35,
    comision_venta: 0.35,
    metodo_compra: 'Zinli',
    metodo_venta: 'Zinli',
    tasa_venta: 36.50,
    tasa_compra: 36.00,
    tasa_retorno: 1.0,
    ciclos_dia: 3,
    metodos_pago: 1,
  };

  it('returns zeros when tasa_compra is 0', () => {
    const result = performLocalCalculations({ ...baseInput, tasa_compra: 0 });
    expect(result.ganancia_ciclo).toBe(0);
    expect(result.ganancia_diaria).toBe(0);
    expect(result.tasa_minima_compra).toBe(0);
  });

  it('calculates positive profit when sell rate > buy rate', () => {
    const result = performLocalCalculations(baseInput);
    expect(result.ganancia_ciclo).toBeGreaterThan(0);
    expect(result.ganancia_porcentaje).toBeGreaterThan(0);
    expect(result.ganancia_diaria).toBe(result.ganancia_ciclo * 3);
    expect(result.ganancia_mensual).toBe(result.ganancia_diaria * 30);
  });

  it('calculates monto_venta correctly', () => {
    const result = performLocalCalculations(baseInput);
    // 1000 * 36.50 * (1 - 0.0035) = 1000 * 36.50 * 0.9965
    const expected = 1000 * 36.50 * (1 - 0.0035);
    expect(result.monto_venta).toBeCloseTo(expected, 2);
  });

  it('breakeven tasa equals tasa_venta * (1-Cb) * (1-Cs)', () => {
    const result = performLocalCalculations(baseInput);
    const expected = 36.50 * (1 - 0.0035) * (1 - 0.0035);
    expect(result.tasa_minima_compra).toBeCloseTo(expected, 4);
  });

  it('handles VES operativa the same as USD', () => {
    const vesInput = { ...baseInput, tipo_operativa: 'VES', tasa_venta: 36.50, tasa_compra: 36.00 };
    const result = performLocalCalculations(vesInput);
    expect(result.ganancia_ciclo).toBeGreaterThan(0);
  });
});

describe('calculateTargetBuyPrices', () => {
  it('returns breakeven and preset percentages', () => {
    const targets = calculateTargetBuyPrices(100, 0.35);
    expect(targets).toHaveLength(4);
    expect(targets[0].label).toBe('Breakeven');
    expect(targets[0].percentage).toBe('0.0%');
    expect(targets[3].percentage).toBe('1.0%');
  });

  it('includes custom percentage when provided', () => {
    const targets = calculateTargetBuyPrices(100, 0.35, 2.5);
    expect(targets).toHaveLength(5);
    expect(targets[4].label).toBe('% Personalizado');
    expect(targets[4].percentage).toBe('2.5%');
  });

  it('breakeven price is lower than selling price', () => {
    const targets = calculateTargetBuyPrices(100, 1.0);
    expect(targets[0].buyPrice).toBeLessThan(100);
  });

  it('higher profit target has lower buy price', () => {
    const targets = calculateTargetBuyPrices(100, 0.5);
    expect(targets[3].buyPrice).toBeLessThan(targets[1].buyPrice);
  });
});
