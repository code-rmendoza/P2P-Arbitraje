import { useState, useEffect } from 'react';
import { performLocalCalculations, saveCalculation, deleteCalculation } from '../api';
import type { SavedCalculation, CalculationInput, CalculationResult } from '../api';

export function useCalculator() {
  const [capital, setCapital] = useState<number>(0);
  const [tipoOperativa, setTipoOperativa] = useState<string>('USD');
  const [plataformaCompra, setPlataformaCompra] = useState<string>('');
  const [plataformaVenta, setPlataformaVenta] = useState<string>('');
  const [comisionCompra, setComisionCompra] = useState<number>(0);
  const [comisionVenta, setComisionVenta] = useState<number>(0);
  const [metodoCompra, setMetodoCompra] = useState<string>('');
  const [metodoVenta, setMetodoVenta] = useState<string>('');
  const [tasaVenta, setTasaVenta] = useState<number>(0);
  const [tasaCompra, setTasaCompra] = useState<number>(0);
  const [tasaRetorno, setTasaRetorno] = useState<number>(1.0);
  const [ciclosDia, setCiclosDia] = useState<number>(1);
  const [metodosPago, setMetodosPago] = useState<number>(1);

  const [calculationResult, setCalculationResult] = useState<CalculationResult>(() =>
    performLocalCalculations({
      capital: 0,
      tipo_operativa: 'USD',
      plataforma_compra: '',
      plataforma_venta: '',
      comision_compra: 0,
      comision_venta: 0,
      metodo_compra: '',
      metodo_venta: '',
      tasa_venta: 0,
      tasa_compra: 0,
      tasa_retorno: 1.0,
      ciclos_dia: 1,
      metodos_pago: 1,
    })
  );

  useEffect(() => {
    const res = performLocalCalculations({
      capital,
      tipo_operativa: tipoOperativa,
      plataforma_compra: plataformaCompra,
      plataforma_venta: plataformaVenta,
      comision_compra: comisionCompra,
      comision_venta: comisionVenta,
      metodo_compra: metodoCompra,
      metodo_venta: metodoVenta,
      tasa_venta: tasaVenta,
      tasa_compra: tasaCompra,
      tasa_retorno: tasaRetorno,
      ciclos_dia: ciclosDia,
      metodos_pago: metodosPago,
    });
    setCalculationResult(res);
  }, [capital, tipoOperativa, plataformaCompra, plataformaVenta, comisionCompra, comisionVenta, metodoCompra, metodoVenta, tasaVenta, tasaCompra, tasaRetorno, ciclosDia, metodosPago]);

  useEffect(() => {
    if (tipoOperativa === 'VES' || tipoOperativa === 'USD') {
      setMetodoCompra('');
      setMetodoVenta('');
      setTasaCompra(0);
      setTasaVenta(0);
      setTasaRetorno(1.0);
    }
  }, [tipoOperativa]);

  const handleSaveSimulation = async (label: string): Promise<boolean> => {
    if (!label.trim()) return false;
    const input: CalculationInput & { label: string } = {
      label,
      capital,
      tipo_operativa: tipoOperativa,
      plataforma_compra: plataformaCompra,
      plataforma_venta: plataformaVenta,
      comision_compra: comisionCompra,
      comision_venta: comisionVenta,
      metodo_compra: metodoCompra,
      metodo_venta: metodoVenta,
      tasa_venta: tasaVenta,
      tasa_compra: tasaCompra,
      tasa_retorno: tasaRetorno,
      ciclos_dia: ciclosDia,
      metodos_pago: metodosPago,
    };
    try {
      await saveCalculation(input);
      return true;
    } catch {
      return false;
    }
  };

  const handleDeleteSimulation = async (id: number): Promise<boolean> => {
    if (confirm('¿Estás seguro de que deseas eliminar esta simulación?')) {
      await deleteCalculation(id);
      return true;
    }
    return false;
  };

  const handleLoadSimulation = (sim: SavedCalculation) => {
    setCapital(sim.capital);
    setTipoOperativa(sim.tipo_operativa);
    setPlataformaCompra(sim.plataforma_compra);
    setPlataformaVenta(sim.plataforma_venta);
    setComisionCompra(sim.comision_compra);
    setComisionVenta(sim.comision_venta);
    setMetodoCompra(sim.metodo_compra);
    setMetodoVenta(sim.metodo_venta);
    setTasaCompra(sim.tasa_compra);
    setTasaVenta(sim.tasa_venta);
    setTasaRetorno(sim.tasa_retorno);
    setCiclosDia(sim.ciclos_dia);
    setMetodosPago(sim.metodos_pago);
  };

  const handleExportText = () => {
    const content = `=== SIMULACION OPERATIVA P2P ===
Fecha: ${new Date().toLocaleString()}
Tipo Operativa: ${tipoOperativa}
Capital Inicial: $${capital.toFixed(2)} USDT
Compra: ${metodoCompra} (${plataformaCompra}) - Com: ${comisionCompra}% - Tasa: ${tasaCompra}
Venta: ${metodoVenta} (${plataformaVenta}) - Com: ${comisionVenta}% - Tasa: ${tasaVenta}
Ciclos al Dia: ${ciclosDia}
Metodos de Pago: ${metodosPago}

--- RESULTADOS ---
Tasa Minima de Compra (Breakeven): ${calculationResult.tasa_minima_compra.toFixed(3)}
Ganancia por Ciclo: $${calculationResult.ganancia_ciclo.toFixed(2)} USDT (${calculationResult.ganancia_porcentaje.toFixed(2)}%)
Monto Operacion Venta: $${calculationResult.monto_venta.toFixed(2)}
Monto Recompra Retorno: $${calculationResult.monto_compra.toFixed(2)}
Ganancia Diaria Total: $${calculationResult.ganancia_diaria.toFixed(2)} USDT
Ganancia Proyectada al Mes: $${calculationResult.ganancia_mensual.toFixed(2)} USDT
`;
    const element = document.createElement('a');
    const file = new Blob([content], { type: 'text/plain' });
    element.href = URL.createObjectURL(file);
    element.download = `P2P_Simulacion_${tipoOperativa}_${capital}USDT.txt`;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  const defaultLabel = `Simulacion ${tipoOperativa} - Cap: ${capital} - ${metodoCompra} a ${metodoVenta}`;

  return {
    capital, setCapital,
    tipoOperativa, setTipoOperativa,
    plataformaCompra, setPlataformaCompra,
    plataformaVenta, setPlataformaVenta,
    comisionCompra, setComisionCompra,
    comisionVenta, setComisionVenta,
    metodoCompra, setMetodoCompra,
    metodoVenta, setMetodoVenta,
    tasaVenta, setTasaVenta,
    tasaCompra, setTasaCompra,
    tasaRetorno, setTasaRetorno,
    ciclosDia, setCiclosDia,
    metodosPago, setMetodosPago,
    calculationResult,
    handleSaveSimulation,
    handleDeleteSimulation,
    handleLoadSimulation,
    handleExportText,
    defaultLabel,
  };
}
