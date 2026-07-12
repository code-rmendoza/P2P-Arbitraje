import { useState } from 'react';
import { saveLog, deleteLog } from '../api';
import type { DailyLog } from '../api';

export function useLogbook(logs: DailyLog[], loadData: () => Promise<void>) {
  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  const [isLogModalOpen, setIsLogModalOpen] = useState(false);
  const [selectedDateStr, setSelectedDateStr] = useState<string | null>(null);

  const [newLogType, setNewLogType] = useState<string>('USD');
  const [newLogPlatCompra, setNewLogPlatCompra] = useState<string>('Binance P2P');
  const [newLogPlatVenta, setNewLogPlatVenta] = useState<string>('Binance P2P');
  const [newLogMetCompra, setNewLogMetCompra] = useState<string>('Zinli');
  const [newLogMetVenta, setNewLogMetVenta] = useState<string>('Zinli');
  const [newLogComCompra, setNewLogComCompra] = useState<number>(0.35);
  const [newLogComVenta, setNewLogComVenta] = useState<number>(0.35);
  const [newLogVolume, setNewLogVolume] = useState<number>(0);
  const [newLogProfit, setNewLogProfit] = useState<number>(0);
  const [newLogNotes, setNewLogNotes] = useState<string>('');

  const [isCloseOperativeModalOpen, setIsCloseOperativeModalOpen] = useState(false);
  const [closeOperativeDate, setCloseOperativeDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [closeOperativeNotes, setCloseOperativeNotes] = useState<string>('');
  const [closeOperativeAccumulate, setCloseOperativeAccumulate] = useState<boolean>(true);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const monthName = currentDate.toLocaleString('es-ES', { month: 'long' });

  const monthLogs = logs.filter(log => {
    const d = new Date(log.date);
    return d.getFullYear() === year && d.getMonth() === month;
  });

  const monthVolumeTotal = monthLogs.reduce((sum, log) => sum + log.volume, 0);
  const monthProfitTotal = monthLogs.reduce((sum, log) => sum + log.profit, 0);

  const firstDayOfMonth = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const jsDay = firstDayOfMonth.getDay();
  const startOffset = jsDay === 0 ? 6 : jsDay - 1;

  const calendarDays: { dateStr: string | null; dayNum: number | null; logs: DailyLog[] }[] = [];
  for (let i = 0; i < startOffset; i++) {
    calendarDays.push({ dateStr: null, dayNum: null, logs: [] });
  }
  for (let d = 1; d <= daysInMonth; d++) {
    const dStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const dayOperations = logs.filter(l => l.date === dStr);
    calendarDays.push({ dateStr: dStr, dayNum: d, logs: dayOperations });
  }
  while (calendarDays.length % 7 !== 0) {
    calendarDays.push({ dateStr: null, dayNum: null, logs: [] });
  }

  const activeDayLogs = selectedDateStr ? logs.filter(l => l.date === selectedDateStr) : [];

  const handleDayClick = (
    dateStr: string,
    tipoOperativa: string,
    plataformaCompra: string,
    plataformaVenta: string,
    metodoCompra: string,
    metodoVenta: string,
    comisionCompra: number,
    comisionVenta: number,
    capital: number,
    gananciaCiclo: number,
  ) => {
    setSelectedDateStr(dateStr);
    setNewLogType(tipoOperativa);
    setNewLogPlatCompra(plataformaCompra);
    setNewLogPlatVenta(plataformaVenta);
    setNewLogMetCompra(metodoCompra);
    setNewLogMetVenta(metodoVenta);
    setNewLogComCompra(comisionCompra);
    setNewLogComVenta(comisionVenta);
    setNewLogVolume(capital);
    setNewLogProfit(parseFloat(gananciaCiclo.toFixed(2)));
    setNewLogNotes('');
    setIsLogModalOpen(true);
  };

  const handleSaveNewOperation = async (notify: (msg: string) => void) => {
    if (!selectedDateStr) return;
    try {
      await saveLog({
        date: selectedDateStr,
        volume: newLogVolume,
        profit: newLogProfit,
        notes: newLogNotes,
        imported: false,
        tipo_operativa: newLogType,
        plataforma_compra: newLogPlatCompra,
        plataforma_venta: newLogPlatVenta,
        comision_compra: newLogComCompra,
        comision_venta: newLogComVenta,
        metodo_compra: newLogMetCompra,
        metodo_venta: newLogMetVenta,
      });
      await loadData();
      setNewLogNotes('');
      notify('Operacion agregada a la bitacora');
    } catch { /* ignore */ }
  };

  const handleDeleteLogItem = async (id: number, notify: (msg: string) => void) => {
    if (confirm('¿Estas seguro de borrar este registro de la bitacora?')) {
      try {
        await deleteLog(id);
        await loadData();
        notify('Operacion eliminada');
      } catch { /* ignore */ }
    }
  };

  const handleExportCSV = () => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const monthLogs = logs.filter(log => {
      const logDate = new Date(log.date);
      return logDate.getFullYear() === year && logDate.getMonth() === month;
    });

    if (monthLogs.length === 0) {
      alert('No hay registros de operativa en este mes para exportar.');
      return;
    }

    let csvContent = 'data:text/csv;charset=utf-8,Fecha,Tipo,Metodo Compra,Metodo Venta,Volumen (USDT),Ganancia (USDT),Importado,Notas\n';
    monthLogs.forEach(log => {
      const row = `"${log.date}","${log.tipo_operativa}","${log.metodo_compra}","${log.metodo_venta}",${log.volume},${log.profit},"${log.imported ? 'SI' : 'NO'}","${log.notes.replace(/"/g, '""')}"`;
      csvContent += row + '\n';
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    const monthName = currentDate.toLocaleString('default', { month: 'long' });
    link.setAttribute('download', `Bitacora_P2P_${monthName}_${year}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return {
    currentDate, setCurrentDate,
    isLogModalOpen, setIsLogModalOpen,
    selectedDateStr,
    newLogType, setNewLogType,
    newLogPlatCompra, setNewLogPlatCompra,
    newLogPlatVenta, setNewLogPlatVenta,
    newLogMetCompra, setNewLogMetCompra,
    newLogMetVenta, setNewLogMetVenta,
    newLogComCompra, setNewLogComCompra,
    newLogComVenta, setNewLogComVenta,
    newLogVolume, setNewLogVolume,
    newLogProfit, setNewLogProfit,
    newLogNotes, setNewLogNotes,
    isCloseOperativeModalOpen, setIsCloseOperativeModalOpen,
    closeOperativeDate, setCloseOperativeDate,
    closeOperativeNotes, setCloseOperativeNotes,
    closeOperativeAccumulate, setCloseOperativeAccumulate,
    year,
    monthName,
    monthVolumeTotal,
    monthProfitTotal,
    calendarDays,
    activeDayLogs,
    handleDayClick,
    handleSaveNewOperation,
    handleDeleteLogItem,
    handleExportCSV,
  };
}
