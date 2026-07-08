import { useState, useEffect } from 'react';
import type { CSSProperties } from 'react';
import { 
  Calculator, 
  TrendingUp, 
  History, 
  Plus, 
  Trash2, 
  Download, 
  ArrowRightLeft, 
  Info,
  DollarSign,
  FileSpreadsheet,
  ChevronLeft,
  ChevronRight,
  CheckCircle,
  ArrowRight,
  WalletCards,
  Edit3,
  X,
  RefreshCw
} from 'lucide-react';
import { 
  performLocalCalculations, 
  calculateTargetBuyPrices, 
  fetchCalculations, 
  saveCalculation, 
  deleteCalculation,
  fetchLogs,
  saveLog,
  deleteLog,
  fetchWallets,
  saveWallet,
  deleteWallet,
  fetchTransactions,
  saveTransaction,
  deleteTransaction,
  fetchBcvRate,
  resetDatabaseSecure,
  checkUpdate,
  applyUpdate
} from './api';
import type { SavedCalculation, CalculationInput, DailyLog, Wallet, Transaction, UpdateInfo } from './api';
let globalSyncLock = false;

function App() {
  // Tabs: 'operative' | 'buy_prices' | 'portfolio' | 'logbook' | 'taxes'
  const [activeTab, setActiveTab] = useState<'operative' | 'buy_prices' | 'portfolio' | 'logbook' | 'taxes'>('operative');
  
  // Status
  const [isOnline, setIsOnline] = useState<boolean>(true);
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
  const [updating, setUpdating] = useState<boolean>(false);
  
  // Calculator 1 State (Operativa Completa)
  const [capital, setCapital] = useState<number>(0);
  const [tipoOperativa, setTipoOperativa] = useState<string>('USD'); // 'USD', 'VES'
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
  
  // Calculator 2 State (Calculadora Precios Compra)
  const [precioVenta, setPrecioVenta] = useState<number>(0);
  const [comisionP2P, setComisionP2P] = useState<number>(0);
  const [percentPersonalizado, setPercentPersonalizado] = useState<number>(0);

  // History & Save Simulation State
  const [history, setHistory] = useState<SavedCalculation[]>([]);
  const [isSaveModalOpen, setIsSaveModalOpen] = useState(false);
  const [saveLabel, setSaveLabel] = useState('');
  
  // Local simulation calculations
  const [calculationResult, setCalculationResult] = useState(() => 
    performLocalCalculations({ 
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
      metodos_pago: metodosPago 
    })
  );

  // Logbook (Bitácora) State
  const [logs, setLogs] = useState<DailyLog[]>([]);
  const [currentDate, setCurrentDate] = useState<Date>(new Date());

  // Portfolio & Ledger State
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isWalletModalOpen, setIsWalletModalOpen] = useState(false);
  const [editingWallet, setEditingWallet] = useState<Wallet | null>(null);
  const [editingWalletId, setEditingWalletId] = useState<number | null>(null);
  const [walletForm, setWalletForm] = useState<Omit<Wallet, 'id' | 'created_at'>>({
    name: '',
    platform: '',
    currency: 'USDT',
    balance: 0,
    opening_balance: 0,
    is_active: true,
    color: '#2563eb'
  });
  const [txWalletFrom, setTxWalletFrom] = useState<string>('');
  const [txWalletTo, setTxWalletTo] = useState<string>('');
  const [txAmountOut, setTxAmountOut] = useState<number>(0);
  const [txRate, setTxRate] = useState<number>(0);
  const [txCommission, setTxCommission] = useState<number>(0);
  const [txManualAmountIn, setTxManualAmountIn] = useState<string>('');
  const [txNotes, setTxNotes] = useState<string>('');
  const getLocalDatetimeString = (date = new Date()) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  };
  const [txDate, setTxDate] = useState<string>(getLocalDatetimeString());
  const [txTypeOverride, setTxTypeOverride] = useState<Transaction['type'] | 'AUTO'>('AUTO');
  const [ledgerWalletFilter, setLedgerWalletFilter] = useState<string>('');
  const [ledgerLimit, setLedgerLimit] = useState<string>('5');
  const [portfolioDateFilter, setPortfolioDateFilter] = useState<string>('today');
  
  // Day Edit Modal State (Multi-transaction list)
  const [isLogModalOpen, setIsLogModalOpen] = useState(false);
  const [selectedDateStr, setSelectedDateStr] = useState<string | null>(null);
  
  // Add operation form state (inside calendar details)
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

  // Close Operative Modal State
  const [isCloseOperativeModalOpen, setIsCloseOperativeModalOpen] = useState(false);
  const [closeOperativeDate, setCloseOperativeDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [closeOperativeNotes, setCloseOperativeNotes] = useState<string>('');
  const [closeOperativeAccumulate, setCloseOperativeAccumulate] = useState<boolean>(true);

  // Success Notification
  const [notification, setNotification] = useState<{message: string, type: 'success' | 'info'} | null>(null);

  // Taxes State (Venezuela ISLR)
  const [isFetchingBcv, setIsFetchingBcv] = useState<boolean>(false);
  const [tasaBcv, setTasaBcv] = useState<number>(() => {
    const local = localStorage.getItem('p2p_tasa_bcv');
    return local ? parseFloat(local) : 0;
  });
  const [valorUt, setValorUt] = useState<number>(() => {
    const local = localStorage.getItem('p2p_valor_ut');
    return local ? parseFloat(local) : 0;
  });

  // Save BCV and UT values to localStorage
  useEffect(() => {
    localStorage.setItem('p2p_tasa_bcv', tasaBcv.toString());
  }, [tasaBcv]);

  useEffect(() => {
    localStorage.setItem('p2p_valor_ut', valorUt.toString());
  }, [valorUt]);

  // Load history, logs, and check backend connectivity
  const loadData = async () => {
    try {
      const dataCalculations = await fetchCalculations();
      setHistory(dataCalculations);
      
      const dataLogs = await fetchLogs();
      setLogs(dataLogs);

      const dataWallets = await fetchWallets();
      setWallets(dataWallets);

      const dataTransactions = await fetchTransactions();
      setTransactions(dataTransactions);

      await syncAllHistoricalTransactionsToLogbook(dataTransactions, dataLogs, dataWallets);

      const updatedLogs = await fetchLogs();
      setLogs(updatedLogs);
      
      setIsOnline(true);
    } catch {
      setIsOnline(false);
      
      // Fallback local load
      const localCalcs = localStorage.getItem('p2p_simulations');
      if (localCalcs) setHistory(JSON.parse(localCalcs));
      
      const localLogs = localStorage.getItem('p2p_logs');
      const parsedLogs = localLogs ? JSON.parse(localLogs) : [];
      setLogs(parsedLogs);

      const localWallets = localStorage.getItem('p2p_wallets');
      const parsedWallets = localWallets ? JSON.parse(localWallets) : [];
      setWallets(parsedWallets);

      const localTransactions = localStorage.getItem('p2p_transactions');
      const parsedTxs = localTransactions ? JSON.parse(localTransactions) : [];
      setTransactions(parsedTxs);

      await syncAllHistoricalTransactionsToLogbook(parsedTxs, parsedLogs, parsedWallets);

      const finalLocalLogs = localStorage.getItem('p2p_logs');
      if (finalLocalLogs) setLogs(JSON.parse(finalLocalLogs));
    }
  };

  useEffect(() => {
    loadData();
    const autoFetchBcv = async () => {
      try {
        const rate = await fetchBcvRate();
        setTasaBcv(prev => prev === 0 ? rate : prev);
      } catch (e) {
        console.warn('Auto-fetch BCV rate on mount failed:', e);
      }
    };
    autoFetchBcv();

    // Periodically verify connection
    const interval = setInterval(loadData, 10000);
    return () => clearInterval(interval);
  }, []);

  // Check for updates on mount
  useEffect(() => {
    checkUpdate().then(info => {
      if (info?.update_available) setUpdateInfo(info);
    }).catch(() => {});
  }, []);

  const handleApplyUpdate = async () => {
    if (!confirm('Se descargara y aplicara la nueva version. El servidor se reiniciara. Continuar?')) return;
    setUpdating(true);
    try {
      const result = await applyUpdate();
      if (result?.success) {
        alert(result.message + '\nEl navegador se reconectara en unos segundos...');
      } else {
        alert('Error al aplicar actualizacion');
        setUpdating(false);
      }
    } catch {
      alert('Error de conexion al actualizar');
      setUpdating(false);
    }
  };

  // Update calculations whenever inputs change
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
      metodos_pago: metodosPago
    });
    setCalculationResult(res);
  }, [capital, tipoOperativa, plataformaCompra, plataformaVenta, comisionCompra, comisionVenta, metodoCompra, metodoVenta, tasaVenta, tasaCompra, tasaRetorno, ciclosDia, metodosPago]);

  // Handle switching tipoOperativa to set sensible defaults
  useEffect(() => {
    if (tipoOperativa === 'VES') {
      setMetodoCompra('');
      setMetodoVenta('');
      setTasaCompra(0);
      setTasaVenta(0);
      setTasaRetorno(1.0);
    } else if (tipoOperativa === 'USD') {
      setMetodoCompra('');
      setMetodoVenta('');
      setTasaCompra(0);
      setTasaVenta(0);
      setTasaRetorno(1.0);
    }
  }, [tipoOperativa]);

  useEffect(() => {
    setTxManualAmountIn('');
  }, [txWalletFrom, txWalletTo, txAmountOut, txRate, txCommission, txTypeOverride]);

  const showNotification = (message: string, type: 'success' | 'info' = 'success') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 4000);
  };

  const handleFetchBcvRate = async () => {
    if (isFetchingBcv) return;
    setIsFetchingBcv(true);
    try {
      const rate = await fetchBcvRate();
      setTasaBcv(rate);
      showNotification(`Tasa BCV obtenida: ${rate.toFixed(4)} Bs./USD`, 'success');
    } catch (e: any) {
      console.error(e);
      showNotification(e.message || 'No se pudo obtener la tasa desde el BCV', 'info');
    } finally {
      setIsFetchingBcv(false);
    }
  };

  // Handle saving simulation
  const handleOpenSaveModal = () => {
    setSaveLabel(`Simulación ${tipoOperativa} - Cap: ${capital} - ${metodoCompra} a ${metodoVenta}`);
    setIsSaveModalOpen(true);
  };

  const handleSave = async () => {
    if (!saveLabel.trim()) return;
    
    const input: CalculationInput & { label: string } = {
      label: saveLabel,
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
      metodos_pago: metodosPago
    };

    try {
      await saveCalculation(input);
      setIsSaveModalOpen(false);
      loadData();
      showNotification('Simulación guardada exitosamente');
    } catch (e) {
      console.error(e);
    }
  };

  const handleDelete = async (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm('¿Estás seguro de que deseas eliminar esta simulación?')) {
      await deleteCalculation(id);
      loadData();
      showNotification('Simulación eliminada');
    }
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
    setActiveTab('operative');
    showNotification('Cargada simulación: ' + sim.label, 'info');
  };

  // Close Operative integration to Logbook
  const handleOpenCloseOperativeModal = () => {
    setCloseOperativeNotes(`Importado de simulador. Compra: ${metodoCompra} (${plataformaCompra}), Venta: ${metodoVenta} (${plataformaVenta}).`);
    setIsCloseOperativeModalOpen(true);
  };

  const handleCloseOperativeSave = async () => {
    const profitToLog = calculationResult.ganancia_diaria; 
    const volumeToLog = capital * ciclosDia; 

    try {
      await saveLog({
        date: closeOperativeDate,
        profit: profitToLog,
        volume: volumeToLog,
        notes: closeOperativeNotes,
        imported: true,
        tipo_operativa: tipoOperativa,
        plataforma_compra: plataformaCompra,
        plataforma_venta: plataformaVenta,
        comision_compra: comisionCompra,
        comision_venta: comisionVenta,
        metodo_compra: metodoCompra,
        metodo_venta: metodoVenta,
        accumulate: closeOperativeAccumulate
      });
      setIsCloseOperativeModalOpen(false);
      loadData();
      showNotification('Operativa registrada en la bitácora');
    } catch (e) {
      console.error(e);
    }
  };

  // Export current simulation results
  const handleExportText = () => {
    const content = `=== SIMULACIÓN OPERATIVA P2P ===
Fecha: ${new Date().toLocaleString()}
Tipo Operativa: ${tipoOperativa}
Capital Inicial: $${capital.toFixed(2)} USDT
Compra: ${metodoCompra} (${plataformaCompra}) - Com: ${comisionCompra}% - Tasa: ${tasaCompra}
Venta: ${metodoVenta} (${plataformaVenta}) - Com: ${comisionVenta}% - Tasa: ${tasaVenta}
Ciclos al Día: ${ciclosDia}
Métodos de Pago: ${metodosPago}

--- RESULTADOS ---
Tasa Mínima de Compra (Breakeven): ${calculationResult.tasa_minima_compra.toFixed(3)}
Ganancia por Ciclo: $${calculationResult.ganancia_ciclo.toFixed(2)} USDT (${calculationResult.ganancia_porcentaje.toFixed(2)}%)
Monto Operación Venta: $${calculationResult.monto_venta.toFixed(2)}
Monto Recompra Retorno: $${calculationResult.monto_compra.toFixed(2)}
Ganancia Diaria Total: $${calculationResult.ganancia_diaria.toFixed(2)} USDT
Ganancia Proyectada al Mes: $${calculationResult.ganancia_mensual.toFixed(2)} USDT
`;
    const element = document.createElement("a");
    const file = new Blob([content], {type: 'text/plain'});
    element.href = URL.createObjectURL(file);
    element.download = `P2P_Simulacion_${tipoOperativa}_${capital}USDT.txt`;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  // CSV Export for Logbook
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

    let csvContent = "data:text/csv;charset=utf-8,Fecha,Tipo,Metodo Compra,Metodo Venta,Volumen (USDT),Ganancia (USDT),Importado,Notas\n";
    monthLogs.forEach(log => {
      const row = `"${log.date}","${log.tipo_operativa}","${log.metodo_compra}","${log.metodo_venta}",${log.volume},${log.profit},"${log.imported ? 'SI' : 'NO'}","${log.notes.replace(/"/g, '""')}"`;
      csvContent += row + "\n";
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    const monthName = currentDate.toLocaleString('default', { month: 'long' });
    link.setAttribute("download", `Bitacora_P2P_${monthName}_${year}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showNotification('Reporte CSV descargado');
  };

  const activeWallets = wallets.filter(wallet => wallet.is_active);
  const selectedWalletFrom = wallets.find(wallet => wallet.id?.toString() === txWalletFrom);
  const selectedWalletTo = wallets.find(wallet => wallet.id?.toString() === txWalletTo);

  const inferTransactionType = (): Transaction['type'] => {
    if (txTypeOverride !== 'AUTO') return txTypeOverride;
    if (selectedWalletFrom?.currency === 'USDT' && selectedWalletTo && selectedWalletTo.currency !== 'USDT') {
      return 'VENTA_P2P';
    }
    if (selectedWalletFrom && selectedWalletFrom.currency !== 'USDT' && selectedWalletTo?.currency === 'USDT') {
      return 'COMPRA_P2P';
    }
    if (!selectedWalletFrom && selectedWalletTo) return 'DEPOSITO';
    if (selectedWalletFrom && !selectedWalletTo) return 'RETIRO';
    return 'TRANSFERENCIA';
  };

  const transactionType = inferTransactionType();
  const calculateTransactionAmountIn = () => {
    if (txAmountOut <= 0) return 0;

    const commissionFactor = 1 - txCommission / 100;
    if (transactionType === 'COMPRA_P2P') {
      return txRate > 0 ? txAmountOut / txRate * commissionFactor : 0;
    }
    if (transactionType === 'VENTA_P2P') {
      return txAmountOut * txRate * commissionFactor;
    }
    if (transactionType === 'TRANSFERENCIA') {
      return selectedWalletFrom?.currency === selectedWalletTo?.currency
        ? txAmountOut * commissionFactor
        : txAmountOut * txRate * commissionFactor;
    }
    if (transactionType === 'DEPOSITO') {
      return txAmountOut;
    }
    return 0;
  };

  const txAmountIn = parseFloat(calculateTransactionAmountIn().toFixed(6));
  const txAmountInDisplay = selectedWalletTo?.currency === 'USDT'
    ? txAmountIn.toFixed(3)
    : txAmountIn.toFixed(2);
  const effectiveTxAmountIn = txManualAmountIn.trim() !== ''
    ? parseFloat(txManualAmountIn) || 0
    : txAmountIn;

  const amountToUsdt = (amount: number, currency?: string | null) => {
    if (currency === 'USDT' || currency === 'USD') return amount;
    if (currency === 'VES') return tasaBcv > 0 ? amount / tasaBcv : 0;
    return 0;
  };

  const getPortfolioDateRange = () => {
    let start: Date | null = null;
    let end: Date | null = null;

    if (portfolioDateFilter === 'today') {
      start = new Date();
      start.setHours(0, 0, 0, 0);
      end = new Date();
      end.setHours(23, 59, 59, 999);
    } else if (portfolioDateFilter === 'yesterday') {
      start = new Date();
      start.setDate(start.getDate() - 1);
      start.setHours(0, 0, 0, 0);
      end = new Date();
      end.setDate(end.getDate() - 1);
      end.setHours(23, 59, 59, 999);
    } else if (portfolioDateFilter === 'month') {
      start = new Date();
      start.setDate(1);
      start.setHours(0, 0, 0, 0);
      end = new Date();
      end.setHours(23, 59, 59, 999);
    }

    return { start, end };
  };

  const { start: portfolioStart, end: portfolioEnd } = getPortfolioDateRange();

  const getFilteredTransactionsForRange = (start: Date | null, end: Date | null) => {
    return transactions.filter(tx => {
      const txDate = new Date(tx.date);
      if (start && txDate < start) return false;
      if (end && txDate > end) return false;
      return true;
    });
  };

  const filteredTransactionsForRange = getFilteredTransactionsForRange(portfolioStart, portfolioEnd);

  const getWalletBalancesForRange = (wallet: Wallet, start: Date | null, end: Date | null) => {
    let closing = wallet.balance;
    let opening = wallet.opening_balance ?? wallet.balance;

    if (end) {
      transactions.forEach(tx => {
        const txDate = new Date(tx.date);
        if (txDate > end) {
          if (tx.wallet_from === wallet.id) {
            closing += tx.amount_out;
          }
          if (tx.wallet_to === wallet.id) {
            closing -= tx.amount_in;
          }
        }
      });
    }

    if (start) {
      let calculatedOpening = wallet.balance;
      transactions.forEach(tx => {
        const txDate = new Date(tx.date);
        if (txDate > start) {
          if (tx.wallet_from === wallet.id) {
            calculatedOpening += tx.amount_out;
          }
          if (tx.wallet_to === wallet.id) {
            calculatedOpening -= tx.amount_in;
          }
        }
      });
      opening = calculatedOpening;
    } else {
      opening = wallet.opening_balance ?? wallet.balance;
    }

    return { opening, closing };
  };

  const syncAllHistoricalTransactionsToLogbook = async (allTxs: Transaction[], allLogs: DailyLog[], allWallets: Wallet[]) => {
    if (globalSyncLock) return;
    globalSyncLock = true;

    try {
      // 1. Clean up any existing duplicate logs in the database
      const autoLogs = allLogs.filter(log => log.notes.includes('[Auto-Transaccion #'));
      const seenTags = new Set<string>();
      
      for (const log of autoLogs) {
        const match = log.notes.match(/\[Auto-Transaccion #\d+\]/);
        if (match) {
          const tag = match[0];
          if (seenTags.has(tag)) {
            console.log(`Eliminando log duplicado para el tag ${tag} (Log ID: ${log.id})`);
            if (log.id) {
              try {
                await deleteLog(log.id);
              } catch (e) {
                console.error(`Error al borrar log duplicado:`, e);
              }
            }
          } else {
            seenTags.add(tag);
          }
        }
      }

      // 2. Perform normal sync of missing logs
      const p2pTxs = allTxs.filter(tx => tx.type === 'COMPRA_P2P' || tx.type === 'VENTA_P2P');
      
      // Find transactions that don't have a corresponding log
      const missingTxs = p2pTxs.filter(tx => {
        const hasLog = allLogs.some(log => log.notes.includes(`[Auto-Transaccion #${tx.id}]`));
        return !hasLog;
      });

      if (missingTxs.length === 0) return;

      console.log(`Sincronizando ${missingTxs.length} transacciones históricas a la bitácora...`);

      // For each missing transaction, save a log entry
      for (const tx of missingTxs) {
        try {
          const txDateStr = tx.date.split('T')[0];
          
          const walletFrom = allWallets.find(w => w.id === tx.wallet_from);
          const walletTo = allWallets.find(w => w.id === tx.wallet_to);
          const fromCurrency = walletFrom?.currency || tx.wallet_from_currency;
          const toCurrency = walletTo?.currency || tx.wallet_to_currency;

          const vol = fromCurrency === 'USDT' || fromCurrency === 'USD'
            ? tx.amount_out 
            : (toCurrency === 'USDT' || toCurrency === 'USD' ? tx.amount_in : amountToUsdt(tx.amount_out, fromCurrency));
          
          const inUsdt = amountToUsdt(tx.amount_in, toCurrency);
          const outUsdt = amountToUsdt(tx.amount_out, fromCurrency);
          const prof = inUsdt - outUsdt;

          await saveLog({
            date: txDateStr,
            profit: parseFloat(prof.toFixed(4)),
            volume: parseFloat(vol.toFixed(2)),
            notes: `[Auto-Transaccion #${tx.id}] Movimiento: ${tx.type} | Ruta: ${tx.wallet_from_name || walletFrom?.name || 'Externo'} → ${tx.wallet_to_name || walletTo?.name || 'Externo'} | Tasa: ${tx.rate} | Notas: ${tx.notes || ''}`,
            imported: true,
            tipo_operativa: fromCurrency === 'VES' || toCurrency === 'VES' ? 'VES' : 'USD',
            plataforma_compra: tx.type === 'COMPRA_P2P' ? walletTo?.platform || tx.wallet_to_platform || 'P2P' : walletFrom?.platform || tx.wallet_from_platform || 'P2P',
            plataforma_venta: tx.type === 'VENTA_P2P' ? walletFrom?.platform || tx.wallet_from_platform || 'P2P' : walletTo?.platform || tx.wallet_to_platform || 'P2P',
            comision_compra: tx.type === 'COMPRA_P2P' ? tx.commission_pct : 0,
            comision_venta: tx.type === 'VENTA_P2P' ? tx.commission_pct : 0,
            metodo_compra: tx.type === 'COMPRA_P2P' ? walletFrom?.name || tx.wallet_from_name || 'P2P' : walletTo?.name || tx.wallet_to_name || 'P2P',
            metodo_venta: tx.type === 'VENTA_P2P' ? walletFrom?.name || tx.wallet_from_name || 'P2P' : walletTo?.name || tx.wallet_to_name || 'P2P',
            accumulate: false
          });
        } catch (e) {
          console.error(`Error al sincronizar transacción #${tx.id}:`, e);
        }
      }
    } finally {
      globalSyncLock = false;
    }
  };

  const totalPortfolioUsdt = wallets
    .filter(wallet => wallet.is_active)
    .reduce((sum, wallet) => {
      const { closing } = getWalletBalancesForRange(wallet, portfolioStart, portfolioEnd);
      return sum + amountToUsdt(closing, wallet.currency);
    }, 0);

  const groupedBalance = (currency: Wallet['currency']) => wallets
    .filter(wallet => wallet.is_active && wallet.currency === currency)
    .reduce((sum, wallet) => {
      const { closing } = getWalletBalancesForRange(wallet, portfolioStart, portfolioEnd);
      return sum + closing;
    }, 0);

  const currencies: Wallet['currency'][] = ['USDT', 'USD', 'VES'];
  const profitRows = currencies.map(currency => {
    const current = wallets
      .filter(wallet => wallet.currency === currency)
      .reduce((sum, wallet) => {
        const { closing } = getWalletBalancesForRange(wallet, portfolioStart, portfolioEnd);
        return sum + closing;
      }, 0);
    const opening = wallets
      .filter(wallet => wallet.currency === currency)
      .reduce((sum, wallet) => {
        const { opening } = getWalletBalancesForRange(wallet, portfolioStart, portfolioEnd);
        return sum + opening;
      }, 0);
    const deposits = filteredTransactionsForRange
      .filter(tx => tx.type === 'DEPOSITO' && tx.wallet_to_currency === currency)
      .reduce((sum, tx) => sum + tx.amount_in, 0);
    const withdrawals = filteredTransactionsForRange
      .filter(tx => tx.type === 'RETIRO' && tx.wallet_from_currency === currency)
      .reduce((sum, tx) => sum + tx.amount_out, 0);
    const profit = current - opening - deposits + withdrawals;

    return {
      currency,
      current,
      opening,
      deposits,
      withdrawals,
      profit,
      profitUsdt: amountToUsdt(profit, currency)
    };
  });

  const totalOpeningUsdt = wallets.reduce(
    (sum, wallet) => {
      const { opening } = getWalletBalancesForRange(wallet, portfolioStart, portfolioEnd);
      return sum + amountToUsdt(opening, wallet.currency);
    },
    0
  );
  const totalDepositsUsdt = filteredTransactionsForRange
    .filter(tx => tx.type === 'DEPOSITO')
    .reduce((sum, tx) => sum + amountToUsdt(tx.amount_in, tx.wallet_to_currency), 0);
  const totalWithdrawalsUsdt = filteredTransactionsForRange
    .filter(tx => tx.type === 'RETIRO')
    .reduce((sum, tx) => sum + amountToUsdt(tx.amount_out, tx.wallet_from_currency), 0);
  const realPortfolioProfitUsdt = profitRows.reduce((sum, row) => sum + row.profitUsdt, 0);
  const realPortfolioProfitPct = totalOpeningUsdt > 0
    ? (realPortfolioProfitUsdt / totalOpeningUsdt) * 100
    : 0;

  const filteredTransactions = (ledgerWalletFilter
    ? transactions.filter(tx => tx.wallet_from?.toString() === ledgerWalletFilter || tx.wallet_to?.toString() === ledgerWalletFilter)
    : transactions
  ).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const displayedTransactions = ledgerLimit === 'all'
    ? filteredTransactions
    : filteredTransactions.slice(0, parseInt(ledgerLimit, 10));

  const resetWalletForm = () => {
    setEditingWallet(null);
    setEditingWalletId(null);
    setWalletForm({
      name: '',
      platform: '',
      currency: 'USDT',
      balance: 0,
      opening_balance: 0,
      is_active: true,
      color: '#2563eb'
    });
  };

  const handleOpenWalletModal = (wallet?: Wallet) => {
    if (wallet) {
      setEditingWallet(wallet);
      setEditingWalletId(wallet.id ?? null);
      setWalletForm({
        name: wallet.name,
        platform: wallet.platform,
        currency: wallet.currency,
        balance: wallet.balance,
        opening_balance: wallet.opening_balance || wallet.balance,
        is_active: wallet.is_active,
        color: wallet.color
      });
    } else {
      resetWalletForm();
    }
    setIsWalletModalOpen(true);
  };

  const handleSaveWallet = async () => {
    if (!walletForm.name.trim() || !walletForm.platform.trim()) return;

    await saveWallet({
      id: editingWalletId ?? editingWallet?.id,
      ...walletForm,
      balance: Number(walletForm.balance) || 0,
      opening_balance: Number(walletForm.opening_balance) || 0
    });
    setIsWalletModalOpen(false);
    resetWalletForm();
    await loadData();
    showNotification(editingWalletId ? 'Billetera actualizada' : 'Billetera creada');
  };

  const handleDeactivateWallet = async (wallet: Wallet) => {
    if (!wallet.id) return;
    await saveWallet({ ...wallet, is_active: false });
    await loadData();
    showNotification('Billetera desactivada', 'info');
  };

  const handleDeleteWallet = async (wallet: Wallet) => {
    if (!wallet.id || !confirm(`¿Eliminar la billetera "${wallet.name}"?`)) return;
    await deleteWallet(wallet.id);
    await loadData();
    showNotification('Billetera eliminada');
  };

  const handleSaveTransaction = async () => {
    if (!selectedWalletFrom && !selectedWalletTo) {
      alert('Selecciona al menos una billetera.');
      return;
    }
    if (txWalletFrom && !selectedWalletFrom) {
      alert('La billetera origen no se pudo resolver. Refresca la página y vuelve a seleccionarla.');
      return;
    }
    if (txWalletTo && !selectedWalletTo) {
      alert('La billetera destino no se pudo resolver. Refresca la página y vuelve a seleccionarla.');
      return;
    }
    if (['VENTA_P2P', 'COMPRA_P2P', 'TRANSFERENCIA'].includes(transactionType) && (!selectedWalletFrom || !selectedWalletTo)) {
      alert('Las compras, ventas y transferencias requieren billetera origen y destino.');
      return;
    }
    if (selectedWalletFrom?.id === selectedWalletTo?.id) {
      alert('La billetera origen y destino deben ser diferentes.');
      return;
    }
    if ((selectedWalletFrom || selectedWalletTo) && txAmountOut <= 0) {
      alert('El monto a enviar debe ser mayor a cero.');
      return;
    }
    if (selectedWalletTo && effectiveTxAmountIn <= 0) {
      alert('El monto que entra debe ser mayor a cero.');
      return;
    }

    try {
      const savedTx = await saveTransaction({
        date: txDate ? new Date(txDate).toISOString() : new Date().toISOString(),
        type: transactionType,
        wallet_from: selectedWalletFrom?.id ?? null,
        wallet_to: selectedWalletTo?.id ?? null,
        amount_out: selectedWalletFrom ? txAmountOut : 0,
        amount_in: selectedWalletTo ? effectiveTxAmountIn : 0,
        rate: txRate,
        commission_pct: txCommission,
        notes: txNotes
      });

      if (transactionType === 'COMPRA_P2P' || transactionType === 'VENTA_P2P') {
        const txDateStr = savedTx.date.split('T')[0];
        
        const vol = selectedWalletFrom?.currency === 'USDT' || selectedWalletFrom?.currency === 'USD'
          ? txAmountOut 
          : (selectedWalletTo?.currency === 'USDT' || selectedWalletTo?.currency === 'USD' ? effectiveTxAmountIn : amountToUsdt(txAmountOut, selectedWalletFrom?.currency));
        
        const inUsdt = amountToUsdt(effectiveTxAmountIn, selectedWalletTo?.currency);
        const outUsdt = amountToUsdt(txAmountOut, selectedWalletFrom?.currency);
        const prof = inUsdt - outUsdt;

        await saveLog({
          date: txDateStr,
          profit: parseFloat(prof.toFixed(4)),
          volume: parseFloat(vol.toFixed(2)),
          notes: `[Auto-Transaccion #${savedTx.id}] Movimiento: ${transactionType} | Ruta: ${selectedWalletFrom?.name || 'Externo'} → ${selectedWalletTo?.name || 'Externo'} | Tasa: ${txRate} | Notas: ${txNotes}`,
          imported: true,
          tipo_operativa: selectedWalletFrom?.currency === 'VES' || selectedWalletTo?.currency === 'VES' ? 'VES' : 'USD',
          plataforma_compra: transactionType === 'COMPRA_P2P' ? selectedWalletTo?.platform || 'P2P' : selectedWalletFrom?.platform || 'P2P',
          plataforma_venta: transactionType === 'VENTA_P2P' ? selectedWalletFrom?.platform || 'P2P' : selectedWalletTo?.platform || 'P2P',
          comision_compra: transactionType === 'COMPRA_P2P' ? txCommission : 0,
          comision_venta: transactionType === 'VENTA_P2P' ? txCommission : 0,
          metodo_compra: transactionType === 'COMPRA_P2P' ? selectedWalletFrom?.name || 'P2P' : selectedWalletTo?.name || 'P2P',
          metodo_venta: transactionType === 'VENTA_P2P' ? selectedWalletFrom?.name || 'P2P' : selectedWalletTo?.name || 'P2P',
          accumulate: false
        });
      }

      setTxAmountOut(0);
      setTxRate(1.0);
      setTxManualAmountIn('');
      setTxNotes('');
      setTxDate(getLocalDatetimeString());
      await loadData();
      showNotification('Movimiento registrado');
    } catch (error: any) {
      alert(error.message || 'No se pudo registrar el movimiento.');
    }
  };

  const handleDeleteTransaction = async (tx: Transaction) => {
    if (!tx.id || !confirm('¿Eliminar este movimiento y revertir saldos?')) return;
    
    const targetLog = logs.find(log => log.notes.includes(`[Auto-Transaccion #${tx.id}]`));
    if (targetLog && targetLog.id) {
      try {
        await deleteLog(targetLog.id);
      } catch (e) {
        console.error('Error al eliminar registro de bitácora asociado:', e);
      }
    }

    await deleteTransaction(tx.id);
    await loadData();
    showNotification('Movimiento eliminado y saldos revertidos');
  };

  const handleResetSystem = async () => {
    if (!confirm('¿Estás seguro de que deseas restablecer por completo el sistema? Esto eliminará de forma permanente todas las billeteras, movimientos, bitácoras e historial tanto del servidor como de este navegador.')) {
      return;
    }
    try {
      await resetDatabaseSecure();
    } catch (e) {
      console.warn('Backend reset failed or offline:', e);
    }
    localStorage.clear();
    window.location.reload();
  };

  // SVG Custom Projections Chart data
  const chartDays = Array.from({ length: 30 }, (_, i) => i + 1);
  const chartPoints = chartDays.map(day => ({
    day,
    profit: day * calculationResult.ganancia_diaria
  }));

  const maxProfit = chartPoints[29].profit || 100;
  const paddingX = 45;
  const paddingY = 20;
  const chartW = 600;
  const chartH = 180;
  
  const getX = (index: number) => paddingX + (index / 29) * (chartW - paddingX * 2);
  const getY = (val: number) => chartH - paddingY - (val / maxProfit) * (chartH - paddingY * 2);

  // Area and Line SVG paths
  let linePath = "";
  let areaPath = "";

  if (chartPoints.length > 0) {
    linePath = `M ${getX(0)} ${getY(chartPoints[0].profit)} `;
    areaPath = `M ${getX(0)} ${chartH - paddingY} L ${getX(0)} ${getY(chartPoints[0].profit)} `;
    
    for (let i = 1; i < chartPoints.length; i++) {
      const pt = chartPoints[i];
      linePath += `L ${getX(i)} ${getY(pt.profit)} `;
      areaPath += `L ${getX(i)} ${getY(pt.profit)} `;
    }
    
    areaPath += `L ${getX(29)} ${chartH - paddingY} Z`;
  }

  // Target Buy Prices Calculator
  const buyTargets = calculateTargetBuyPrices(precioVenta, comisionP2P, percentPersonalizado);

  // --- CALENDAR GENERATION LOGIC ---
  const handlePrevMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  };

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  // Month stats (Sum all daily operations of the month)
  const monthName = currentDate.toLocaleString('es-ES', { month: 'long' });
  const monthLogs = logs.filter(log => {
    const d = new Date(log.date + 'T00:00:00');
    return d.getFullYear() === year && d.getMonth() === month;
  });

  const monthVolumeTotal = monthLogs.reduce((sum, log) => sum + log.volume, 0);
  const monthProfitTotal = monthLogs.reduce((sum, log) => sum + log.profit, 0);

  // Calendar cells
  const firstDayOfMonth = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  
  const jsDay = firstDayOfMonth.getDay();
  const startOffset = jsDay === 0 ? 6 : jsDay - 1;

  const calendarDays: { dateStr: string | null; dayNum: number | null; logs: DailyLog[] }[] = [];

  // Add empty slots
  for (let i = 0; i < startOffset; i++) {
    calendarDays.push({ dateStr: null, dayNum: null, logs: [] });
  }

  // Add day slots
  for (let d = 1; d <= daysInMonth; d++) {
    const dStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const dayOperations = logs.filter(l => l.date === dStr);
    calendarDays.push({ dateStr: dStr, dayNum: d, logs: dayOperations });
  }

  // Pad to 42 cells
  while (calendarDays.length % 7 !== 0) {
    calendarDays.push({ dateStr: null, dayNum: null, logs: [] });
  }

  const handleDayClick = (dateStr: string) => {
    setSelectedDateStr(dateStr);
    
    // Clear add operation form inputs
    setNewLogType(tipoOperativa);
    setNewLogPlatCompra(plataformaCompra);
    setNewLogPlatVenta(plataformaVenta);
    setNewLogMetCompra(metodoCompra);
    setNewLogMetVenta(metodoVenta);
    setNewLogComCompra(comisionCompra);
    setNewLogComVenta(comisionVenta);
    setNewLogVolume(capital);
    setNewLogProfit(parseFloat(calculationResult.ganancia_ciclo.toFixed(2)));
    setNewLogNotes('');
    
    setIsLogModalOpen(true);
  };

  const handleSaveNewOperation = async () => {
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
        metodo_venta: newLogMetVenta
      });
      loadData();
      // Clear form note and profit to prevent accidental double tap
      setNewLogNotes('');
      showNotification('Operación agregada a la bitácora');
    } catch (e) {
      console.error(e);
    }
  };

  const handleDeleteLogItem = async (id: number) => {
    if (confirm(`¿Estás seguro de borrar este registro de la bitácora?`)) {
      try {
        await deleteLog(id);
        loadData();
        showNotification('Operación eliminada');
      } catch (e) {
        console.error(e);
      }
    }
  };

  // Get active day logs shown in modal
  const activeDayLogs = selectedDateStr ? logs.filter(l => l.date === selectedDateStr) : [];

  // --- FISCAL ESTIMATOR LOGIC (Separation of USD / VES) ---
  // Subject to local tax in Venezuela: ONLY operations involving VES
  const currentYearFiscalLogs = logs.filter(log => {
    const d = new Date(log.date + 'T00:00:00');
    return d.getFullYear() === year && log.tipo_operativa === 'VES';
  });

  const yearProfitUsdt = currentYearFiscalLogs.reduce((sum, log) => sum + log.profit, 0);
  const profitInBoli = yearProfitUsdt * tasaBcv;
  const profitInUt = valorUt > 0 ? profitInBoli / valorUt : 0;

  // SENIAT Tariff Brackets
  const islrBrackets = [
    { limitUt: 1000, rate: 0.06, sustraendoUt: 0, label: "Hasta 1.000 UT" },
    { limitUt: 1500, rate: 0.09, sustraendoUt: 30, label: "1.000,01 - 1.500 UT" },
    { limitUt: 2000, rate: 0.12, sustraendoUt: 75, label: "1.500,01 - 2.000 UT" },
    { limitUt: 2500, rate: 0.16, sustraendoUt: 155, label: "2.000,01 - 2.500 UT" },
    { limitUt: 3000, rate: 0.20, sustraendoUt: 255, label: "2.500,01 - 3.000 UT" },
    { limitUt: 4000, rate: 0.24, sustraendoUt: 375, label: "3.000,01 - 4.000 UT" },
    { limitUt: 6000, rate: 0.29, sustraendoUt: 575, label: "4.000,01 - 6.000 UT" },
    { limitUt: Infinity, rate: 0.34, sustraendoUt: 875, label: "6.000,01 en adelante" }
  ];

  // Determine active bracket
  let activeBracketIndex = 0;
  for (let i = 0; i < islrBrackets.length; i++) {
    if (profitInUt <= islrBrackets[i].limitUt) {
      activeBracketIndex = i;
      break;
    }
  }

  const activeBracket = islrBrackets[activeBracketIndex];
  const isBelowDeclaringLimit = profitInUt < 1000;
  
  let taxOwedUt = 0;
  if (!isBelowDeclaringLimit) {
    taxOwedUt = (profitInUt * activeBracket.rate) - activeBracket.sustraendoUt;
    if (taxOwedUt < 0) taxOwedUt = 0;
  }
  
  const taxOwedBoli = taxOwedUt * valorUt;
  const taxOwedUsdt = tasaBcv > 0 ? taxOwedBoli / tasaBcv : 0;

  // Total un-taxed USD profit (USD operations only)
  const usdOnlyLogs = logs.filter(log => {
    const d = new Date(log.date + 'T00:00:00');
    return d.getFullYear() === year && log.tipo_operativa === 'USD';
  });
  const yearUsdProfitTotal = usdOnlyLogs.reduce((sum, log) => sum + log.profit, 0);

  return (
    <div className="app-container">
      {/* Floating Success Notification */}
      {notification && (
        <div style={{
          position: 'fixed',
          bottom: '2rem',
          right: '2rem',
          backgroundColor: notification.type === 'success' ? 'var(--color-success)' : 'var(--color-primary)',
          color: '#ffffff',
          padding: '0.85rem 1.5rem',
          borderRadius: 'var(--radius-sm)',
          boxShadow: 'var(--shadow-lg)',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          fontWeight: 600,
          fontSize: '0.9rem',
          zIndex: 200,
          animation: 'modalSlide 0.2s ease-out'
        }}>
          <CheckCircle style={{ width: '1.2rem', height: '1.2rem' }} />
          {notification.message}
        </div>
      )}

      {/* Navbar Header */}
      <header className="header">
        <div className="logo-container">
          <ArrowRightLeft className="logo-icon" />
          <h1 className="logo-text">
            P2P Arbitrage
            <span className="logo-badge">V1.1</span>
          </h1>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div className={`status-badge ${isOnline ? 'online' : 'offline'}`}>
            <span className="status-dot"></span>
            {isOnline ? 'SQLite Conectado' : 'Modo Offline (Local)'}
          </div>
          {updateInfo?.update_available && (
            <button
              onClick={handleApplyUpdate}
              disabled={updating}
              className="status-badge update-badge"
              title={`Actualizar de ${updateInfo.current_version} a ${updateInfo.latest_version}`}
            >
              <span className="status-dot update-dot"></span>
              {updating ? 'Actualizando...' : `Update v${updateInfo.latest_version}`}
            </button>
          )}
        </div>
      </header>

      {/* Main Grid Area */}
      <main className={`main-content ${activeTab === 'portfolio' || activeTab === 'logbook' || activeTab === 'taxes' ? 'full-width' : ''}`}>
        {/* Left/Main Column: Tabs Content */}
        <div>
          {/* Tabs header */}
          <div className="tabs-container">
            <button 
              className={`tab-btn ${activeTab === 'operative' ? 'active' : ''}`}
              onClick={() => setActiveTab('operative')}
            >
              Cálculo de Operativa
            </button>
            <button 
              className={`tab-btn ${activeTab === 'buy_prices' ? 'active' : ''}`}
              onClick={() => setActiveTab('buy_prices')}
            >
              Calculadora de Compras
            </button>
            <button 
              className={`tab-btn ${activeTab === 'logbook' ? 'active' : ''}`}
              onClick={() => setActiveTab('logbook')}
            >
              Bitácora P2P
            </button>
            <button 
              className={`tab-btn ${activeTab === 'portfolio' ? 'active' : ''}`}
              onClick={() => setActiveTab('portfolio')}
            >
              Portafolio
            </button>
            <button 
              className={`tab-btn ${activeTab === 'taxes' ? 'active' : ''}`}
              onClick={() => setActiveTab('taxes')}
            >
              Estimación Fiscal
            </button>
          </div>

          {/* TAB 1: Operativa Completa */}
          {activeTab === 'operative' && (
            <div className="card">
              <div className="card-title">
                <Calculator className="logo-icon" style={{ width: '1.5rem', height: '1.5rem' }} />
                Configuración de Operativa
              </div>
              <div className="card-subtitle">
                Ajusta las variables de capital, tasas y ciclos para simular los rendimientos de tu arbitraje.
              </div>

              {/* Form Grid */}
              <div className="form-grid">
                <div className="form-group">
                  <label className="form-label">
                    Tipo de Operativa
                  </label>
                  <select 
                    className="form-input"
                    value={tipoOperativa}
                    onChange={(e) => setTipoOperativa(e.target.value)}
                    style={{ fontWeight: 600 }}
                  >
                    <option value="USD">Operar en USD (Zinli, Wally, etc.)</option>
                    <option value="VES">Operar en VES (Bancos locales)</option>
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">
                    Capital Inicial
                  </label>
                  <div className="input-wrapper">
                    <span className="input-prefix">$</span>
                    <input 
                      type="number" 
                      className="form-input"
                      value={capital}
                      onChange={(e) => setCapital(parseFloat(e.target.value) || 0)}
                      onFocus={(e) => e.target.select()}
                      step="50"
                      min="0"
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Ciclos al Día</label>
                  <select 
                    className="form-input"
                    value={ciclosDia}
                    onChange={(e) => setCiclosDia(parseInt(e.target.value) || 1)}
                  >
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(val => (
                      <option key={val} value={val}>{val} {val === 1 ? 'ciclo' : 'ciclos'}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="tx-separator" style={{ margin: '1rem 0' }}></div>

              {/* Purchase Side Detail */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.25rem', marginBottom: '1.25rem' }}>
                <div className="form-group">
                  <label className="form-label" style={{ color: 'var(--color-primary)' }}>Plataforma Compra</label>
                  <input 
                    type="text" 
                    className="form-input"
                    value={plataformaCompra}
                    onChange={(e) => setPlataformaCompra(e.target.value)}
                    onFocus={(e) => e.target.select()}
                    placeholder="Ej. Binance P2P"
                  />
                </div>
                <div className="form-group">
                  <label className="form-label" style={{ color: 'var(--color-primary)' }}>Método Compra (Billetera/Banco)</label>
                  <input 
                    type="text" 
                    className="form-input"
                    value={metodoCompra}
                    onChange={(e) => setMetodoCompra(e.target.value)}
                    onFocus={(e) => e.target.select()}
                    placeholder="Ej. Zinli, Pago Móvil"
                  />
                </div>
                <div className="form-group">
                  <label className="form-label" style={{ color: 'var(--color-primary)' }}>Tasa de Compra</label>
                  <input 
                    type="number" 
                    className="form-input"
                    value={tasaCompra}
                    onChange={(e) => setTasaCompra(parseFloat(e.target.value) || 0)}
                    onFocus={(e) => e.target.select()}
                    step="0.001"
                    min="0"
                  />
                </div>
                <div className="form-group">
                  <label className="form-label" style={{ color: 'var(--color-primary)' }}>Comisión Compra P2P %</label>
                  <input 
                    type="number" 
                    className="form-input"
                    value={comisionCompra}
                    onChange={(e) => setComisionCompra(parseFloat(e.target.value) || 0)}
                    onFocus={(e) => e.target.select()}
                    step="0.05"
                    min="0"
                  />
                </div>
              </div>

              {/* Selling Side Detail */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.25rem', marginBottom: '1.25rem' }}>
                <div className="form-group">
                  <label className="form-label" style={{ color: 'var(--color-accent)' }}>Plataforma Venta</label>
                  <input 
                    type="text" 
                    className="form-input"
                    value={plataformaVenta}
                    onChange={(e) => setPlataformaVenta(e.target.value)}
                    onFocus={(e) => e.target.select()}
                    placeholder="Ej. Binance P2P"
                  />
                </div>
                <div className="form-group">
                  <label className="form-label" style={{ color: 'var(--color-accent)' }}>Método Venta (Billetera/Banco)</label>
                  <input 
                    type="text" 
                    className="form-input"
                    value={metodoVenta}
                    onChange={(e) => setMetodoVenta(e.target.value)}
                    onFocus={(e) => e.target.select()}
                    placeholder="Ej. Zinli, Pago Móvil"
                  />
                </div>
                <div className="form-group">
                  <label className="form-label" style={{ color: 'var(--color-accent)' }}>Tasa de Venta</label>
                  <input 
                    type="number" 
                    className="form-input"
                    value={tasaVenta}
                    onChange={(e) => setTasaVenta(parseFloat(e.target.value) || 0)}
                    onFocus={(e) => e.target.select()}
                    step="0.001"
                    min="0"
                  />
                </div>
                <div className="form-group">
                  <label className="form-label" style={{ color: 'var(--color-accent)' }}>Comisión Venta P2P %</label>
                  <input 
                    type="number" 
                    className="form-input"
                    value={comisionVenta}
                    onChange={(e) => setComisionVenta(parseFloat(e.target.value) || 0)}
                    onFocus={(e) => e.target.select()}
                    step="0.05"
                    min="0"
                  />
                </div>
              </div>



              {/* Metrics Output Dashboard */}
              <div className="metrics-grid">
                <div className="metric-card success">
                  <div className="metric-label">Ganancia por Ciclo</div>
                  <div className="metric-value">
                    ${calculationResult.ganancia_ciclo.toFixed(2)}
                    <span style={{ fontSize: '0.85rem', fontWeight: 500, color: 'var(--color-success-hover)', marginLeft: '0.35rem' }}>
                      USDT
                    </span>
                  </div>
                  <div className="metric-desc">Márgenes netos por ciclo de arbitraje</div>
                </div>

                <div className="metric-card accent">
                  <div className="metric-label">Porcentaje Ganancia</div>
                  <div className="metric-value">
                    {calculationResult.ganancia_porcentaje.toFixed(2)}%
                  </div>
                  <div className="metric-desc">Retorno por ciclo neto de comisiones</div>
                </div>

                <div className="metric-card success">
                  <div className="metric-label">Ganancia Proyectada al Mes</div>
                  <div className="metric-value">
                    ${calculationResult.ganancia_mensual.toFixed(2)}
                    <span style={{ fontSize: '0.85rem', fontWeight: 500, color: 'var(--color-success-hover)', marginLeft: '0.35rem' }}>
                      USDT
                    </span>
                  </div>
                  <div className="metric-desc">Proyectado a {ciclosDia} ciclos diarios (30 días)</div>
                </div>

                <div className="metric-card warning">
                  <div className="metric-label">Tasa Máxima Compra (Breakeven)</div>
                  <div className="metric-value" style={{ color: 'var(--text-main)' }}>
                    {calculationResult.tasa_minima_compra.toFixed(3)}
                  </div>
                  <div className="metric-desc">Tasa compra límite para no perder dinero</div>
                </div>
              </div>

              {/* Table of the Operational Flow */}
              <h3 className="card-title" style={{ fontSize: '1.05rem', borderTop: '1px solid var(--border-color)', paddingTop: '1.5rem' }}>
                Detalle del Flujo de Operación ({tipoOperativa})
              </h3>
              <div className="table-responsive">
                <table className="custom-table">
                  <thead>
                    <tr>
                      <th>Paso</th>
                      <th>Detalle de Operación</th>
                      <th>Tasa</th>
                      <th>Monto Resultante</th>
                      <th>Comisión</th>
                    </tr>
                  </thead>
                  <tbody>
                    <>
                        <tr>
                          <td>1</td>
                          <td style={{ fontWeight: 600 }}>Venta Lote Completo (USDT ➜ Fiat con {metodoVenta})</td>
                          <td>{tasaVenta.toFixed(3)}</td>
                          <td>{calculationResult.monto_venta.toFixed(2)} {tipoOperativa === 'VES' ? 'VES' : 'USD'}</td>
                          <td>{comisionVenta.toFixed(2)}%</td>
                        </tr>
                        <tr>
                          <td>2</td>
                          <td style={{ fontWeight: 600 }}>Compra de USDT (Fiat ➜ USDT con {metodoCompra})</td>
                          <td>{tasaCompra.toFixed(3)}</td>
                          <td style={{ color: 'var(--color-success-hover)', fontWeight: 700 }}>
                            {calculationResult.monto_compra.toFixed(2)} USDT
                          </td>
                          <td>{comisionCompra.toFixed(2)}%</td>
                        </tr>
                    </>
                  </tbody>
                </table>
              </div>

              {/* Action Buttons */}
              <div className="actions-row">
                <button className="btn btn-primary" onClick={handleOpenSaveModal}>
                  <Plus style={{ width: '1.1rem', height: '1.1rem' }} />
                  Guardar Simulación
                </button>
                <button className="btn btn-secondary" style={{ border: '1px solid var(--color-primary)', color: 'var(--color-primary)' }} onClick={handleOpenCloseOperativeModal}>
                  <CheckCircle style={{ width: '1.1rem', height: '1.1rem' }} />
                  Cerrar Operativa en Bitácora
                </button>
                <button className="btn btn-secondary" onClick={handleExportText}>
                  <Download style={{ width: '1.1rem', height: '1.1rem' }} />
                  Exportar Reporte
                </button>
              </div>
            </div>
          )}

          {/* TAB 2: Calculadora de Precios de Compra */}
          {activeTab === 'buy_prices' && (
            <div className="card">
              <div className="card-title">
                <TrendingUp className="logo-icon" style={{ width: '1.5rem', height: '1.5rem' }} />
                Calculadora de Precios de Compra P2P
              </div>
              <div className="card-subtitle">
                A partir de tu precio de venta y comisión, calcula los precios máximos a los que debes comprar para asegurar un margen de ganancia.
              </div>

              <div className="form-grid" style={{ gridTemplateColumns: '1fr 1fr 1fr' }}>
                <div className="form-group">
                  <label className="form-label">Precio de Venta</label>
                  <input 
                    type="number" 
                    className="form-input"
                    value={precioVenta}
                    onChange={(e) => setPrecioVenta(parseFloat(e.target.value) || 0)}
                    onFocus={(e) => e.target.select()}
                    step="0.001"
                    min="0"
                  />
                </div>
                
                <div className="form-group">
                  <label className="form-label">Comisión P2P %</label>
                  <input 
                    type="number" 
                    className="form-input"
                    value={comisionP2P}
                    onChange={(e) => setComisionP2P(parseFloat(e.target.value) || 0)}
                    onFocus={(e) => e.target.select()}
                    step="0.05"
                    min="0"
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">% Personalizado Objetivo</label>
                  <div className="input-wrapper">
                    <span className="input-prefix">%</span>
                    <input 
                      type="number" 
                      className="form-input"
                      value={percentPersonalizado}
                      onChange={(e) => setPercentPersonalizado(parseFloat(e.target.value) || 0)}
                      onFocus={(e) => e.target.select()}
                      step="0.1"
                      min="0"
                    />
                  </div>
                </div>
              </div>

              {/* Output Target Prices */}
              <h3 className="card-title" style={{ fontSize: '1.05rem', borderTop: '1px solid var(--border-color)', paddingTop: '1.5rem', marginBottom: '1rem' }}>
                Precios de Compra Objetivos
              </h3>
              
              <div className="buy-prices-container">
                {buyTargets.map((target, index) => {
                  const isBreakeven = target.label === 'Breakeven';
                  const isCustom = target.label === '% Personalizado';
                  
                  return (
                    <div 
                      key={index} 
                      className={`buy-price-item ${isBreakeven ? 'breakeven' : ''} ${isCustom ? 'custom-highlight' : ''}`}
                    >
                      <div className="buy-price-label-group">
                        <span className="buy-price-percent">{target.percentage} Ganancia</span>
                        <span className="buy-price-label">
                          {isBreakeven ? 'Punto de Equilibrio (Breakeven)' : isCustom ? 'Margen Personalizado Ajustado' : `Margen de Ganancia del ${target.label}`}
                        </span>
                      </div>
                      <div className="buy-price-value">
                        {target.buyPrice.toFixed(3)}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB 3: Bitácora P2P (Calendario) */}
          {activeTab === 'logbook' && (
            <div className="card">
              <div className="calendar-header-row">
                <div className="calendar-title-nav">
                  <button className="calendar-nav-btn" onClick={handlePrevMonth}>
                    <ChevronLeft style={{ width: '1.25rem', height: '1.25rem' }} />
                  </button>
                  <span className="calendar-title">{monthName} {year}</span>
                  <button className="calendar-nav-btn" onClick={handleNextMonth}>
                    <ChevronRight style={{ width: '1.25rem', height: '1.25rem' }} />
                  </button>
                </div>
                
                <div className="calendar-stats">
                  <div className="calendar-stat-item">
                    <span className="calendar-stat-label">Volumen Mensual</span>
                    <span className="calendar-stat-value">${monthVolumeTotal.toFixed(2)} USDT</span>
                  </div>
                  <div className="calendar-stat-item">
                    <span className="calendar-stat-label">Profit Mes Actual</span>
                    <span className="calendar-stat-value profit">
                      {monthProfitTotal >= 0 ? '+' : ''}${monthProfitTotal.toFixed(2)} USDT
                    </span>
                  </div>
                  <button className="btn btn-secondary" style={{ padding: '0.5rem 1rem' }} onClick={handleExportCSV}>
                    <FileSpreadsheet style={{ width: '1rem', height: '1rem' }} />
                    Exportar CSV
                  </button>
                </div>
              </div>

              {/* Calendar Grid */}
              <div className="calendar-grid">
                {/* Days names headers */}
                {['LUN', 'MAR', 'MIÉ', 'JUE', 'VIE', 'SÁ', 'DOM'].map(name => (
                  <div key={name} className="calendar-day-name">{name}</div>
                ))}

                {/* Calendar cell cards */}
                {calendarDays.map((cell, idx) => {
                  if (!cell.dayNum || !cell.dateStr) {
                    return <div key={`empty-${idx}`} className="calendar-day empty" />;
                  }

                  const { logs: dayOperations, dateStr, dayNum } = cell;
                  let activityClass = 'inactive';
                  
                  // Compute aggregated daily stats
                  const dayProfit = dayOperations.reduce((sum, o) => sum + o.profit, 0);
                  const dayVolume = dayOperations.reduce((sum, o) => sum + o.volume, 0);
                  const hasImported = dayOperations.some(o => o.imported);

                  if (dayVolume > 0) {
                    if (dayVolume > 2000) {
                      activityClass = 'high-volume';
                    } else {
                      activityClass = 'slow-volume';
                    }
                  }

                  return (
                    <div 
                      key={dateStr} 
                      className={`calendar-day ${activityClass}`}
                      onClick={() => handleDayClick(dateStr)}
                    >
                      <span className="calendar-day-num">{dayNum}</span>
                      
                      {dayOperations.length > 0 && (
                        <>
                          {hasImported && <span className="imported-indicator" title="Importado de Operativa"></span>}
                          
                          {/* Tags showing currencies processed on this day */}
                          <div style={{ display: 'flex', gap: '0.2rem', position: 'absolute', bottom: '6px', left: '6px', flexWrap: 'wrap' }}>
                            {dayOperations.some(o => o.tipo_operativa === 'USD') && <span className="legend-dot" style={{ backgroundColor: 'var(--color-primary)', width: '6px', height: '6px' }} title="USD Operations"></span>}
                            {dayOperations.some(o => o.tipo_operativa === 'VES') && <span className="legend-dot" style={{ backgroundColor: '#d97706', width: '6px', height: '6px' }} title="VES Operations"></span>}
                          </div>

                          <div className="calendar-day-data">
                            <span className={`calendar-day-profit-val ${dayProfit > 0 ? 'positive' : dayProfit < 0 ? 'negative' : ''}`}>
                              {dayProfit > 0 ? '+' : ''}{dayProfit.toFixed(1)}
                            </span>
                            <span className="calendar-day-vol-val">V: {dayVolume.toFixed(2)}</span>
                          </div>
                        </>
                      )}
                      
                      {dayOperations.length === 0 && (
                        <div className="calendar-day-data">
                          <span className="calendar-day-profit-val">0.0</span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Legend Row */}
              <div className="calendar-legend-row">
                <div className="legend-item">
                  <span className="legend-dot inactive"></span>
                  <span>Nulo / Inactivo</span>
                </div>
                <div className="legend-item">
                  <span className="legend-dot slow"></span>
                  <span>Operación Lenta (Vol ≤ 2000 USDT)</span>
                </div>
                <div className="legend-item">
                  <span className="legend-dot high"></span>
                  <span>Alto Volumen (Vol &gt; 2000 USDT)</span>
                </div>
                <div className="legend-item">
                  <span className="legend-dot imported"></span>
                  <span>Importado de Operativa</span>
                </div>
                <div className="legend-item" style={{ marginLeft: '1rem', borderLeft: '1px solid var(--border-color)', paddingLeft: '1rem' }}>
                  <span className="legend-dot" style={{ backgroundColor: 'var(--color-primary)', borderRadius: '50%', width: '8px', height: '8px' }}></span>
                  <span>Operado en USD</span>
                </div>
                <div className="legend-item">
                  <span className="legend-dot" style={{ backgroundColor: '#d97706', borderRadius: '50%', width: '8px', height: '8px' }}></span>
                  <span>Operado en VES</span>
                </div>

              </div>
            </div>
          )}

          {/* TAB 4: Estimación Fiscal (Venezuela ISLR) */}
          {activeTab === 'portfolio' && (
            <div className="card">
              <div className="card-title">
                <WalletCards className="logo-icon" style={{ width: '1.5rem', height: '1.5rem' }} />
                Portafolio & Libro Contable
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.5rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '1rem' }}>
                <div className="card-subtitle" style={{ margin: 0 }}>
                  Saldos reales por billetera y movimientos de doble entrada. Cada venta y compra P2P se registra por separado.
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                  <button 
                    className="btn btn-secondary" 
                    onClick={handleResetSystem} 
                    title="Restablecer base de datos y local storage a 0"
                    style={{ padding: '0.4rem 0.75rem', fontSize: '0.85rem', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: '0.3rem', color: '#dc2626', borderColor: '#fca5a5' }}
                  >
                    <Trash2 style={{ width: '0.85rem', height: '0.85rem' }} />
                    Reiniciar Sistema
                  </button>
                  <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-muted)' }}>Filtrar Periodo:</span>
                  <select className="form-input" style={{ width: '180px', padding: '0.4rem 0.75rem', fontSize: '0.85rem', margin: 0 }} value={portfolioDateFilter} onChange={(e) => setPortfolioDateFilter(e.target.value)}>
                    <option value="today">Hoy</option>
                    <option value="yesterday">Ayer</option>
                    <option value="month">Este Mes</option>
                    <option value="all">Histórico General</option>
                  </select>
                </div>
              </div>

              <div className="portfolio-kpi-row">
                <div className="metric-card success">
                  <span className="metric-label">Total consolidado</span>
                  <span className="metric-value">${totalPortfolioUsdt.toFixed(2)}</span>
                  <span className="metric-desc">Estimado en USDT usando USD 1:1 y BCV para VES</span>
                </div>
                <div className={`metric-card ${realPortfolioProfitUsdt >= 0 ? 'success' : ''}`}>
                  <span className="metric-label">Profit real</span>
                  <span className="metric-value" style={{ color: realPortfolioProfitUsdt >= 0 ? 'var(--color-success)' : 'var(--color-danger)' }}>
                    {realPortfolioProfitUsdt >= 0 ? '+' : ''}${realPortfolioProfitUsdt.toFixed(2)}
                  </span>
                  <span className="metric-desc">
                    {realPortfolioProfitPct >= 0 ? '+' : ''}{realPortfolioProfitPct.toFixed(2)}% sobre capital inicial
                  </span>
                </div>
                <div className="metric-card">
                  <span className="metric-label">USDT</span>
                  <span className="metric-value">{groupedBalance('USDT').toFixed(2)}</span>
                  <span className="metric-desc">Disponible en wallets cripto</span>
                </div>
                <div className="metric-card accent">
                  <span className="metric-label">USD</span>
                  <span className="metric-value">{groupedBalance('USD').toFixed(2)}</span>
                  <span className="metric-desc">Zinli, Wally u otros saldos USD</span>
                </div>
                <div className="metric-card warning">
                  <span className="metric-label">VES</span>
                  <span className="metric-value">{groupedBalance('VES').toFixed(0)}</span>
                  <span className="metric-desc">Equiv. ${(tasaBcv > 0 ? groupedBalance('VES') / tasaBcv : 0).toFixed(2)} USDT</span>
                </div>
              </div>

              <div className="table-responsive">
                <table className="custom-table">
                  <thead>
                    <tr>
                      <th>Moneda</th>
                      <th>Saldo actual</th>
                      <th>Capital inicial</th>
                      <th>Depósitos</th>
                      <th>Retiros</th>
                      <th>Profit real</th>
                    </tr>
                  </thead>
                  <tbody>
                    {profitRows.map(row => (
                      <tr key={row.currency}>
                        <td><span className="badge badge-platform">{row.currency}</span></td>
                        <td>{row.current.toFixed(row.currency === 'VES' ? 0 : 2)}</td>
                        <td>{row.opening.toFixed(row.currency === 'VES' ? 0 : 2)}</td>
                        <td>{row.deposits.toFixed(row.currency === 'VES' ? 0 : 2)}</td>
                        <td>{row.withdrawals.toFixed(row.currency === 'VES' ? 0 : 2)}</td>
                        <td className={row.profit >= 0 ? 'tx-amount-in' : 'tx-amount-out'}>
                          {row.profit >= 0 ? '+' : ''}{row.profit.toFixed(row.currency === 'VES' ? 0 : 2)} {row.currency}
                        </td>
                      </tr>
                    ))}
                    <tr>
                      <td><strong>Total USDT</strong></td>
                      <td>{totalPortfolioUsdt.toFixed(2)}</td>
                      <td>{totalOpeningUsdt.toFixed(2)}</td>
                      <td>{totalDepositsUsdt.toFixed(2)}</td>
                      <td>{totalWithdrawalsUsdt.toFixed(2)}</td>
                      <td className={realPortfolioProfitUsdt >= 0 ? 'tx-amount-in' : 'tx-amount-out'}>
                        {realPortfolioProfitUsdt >= 0 ? '+' : ''}{realPortfolioProfitUsdt.toFixed(2)} USDT
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <div className="ledger-filter-row">
                <h3 className="card-title" style={{ fontSize: '1.05rem', marginBottom: 0 }}>Billeteras</h3>
                <button className="btn btn-primary" onClick={() => handleOpenWalletModal()}>
                  <Plus style={{ width: '1rem', height: '1rem' }} />
                  Agregar Billetera
                </button>
              </div>

              {wallets.length === 0 ? (
                <div className="empty-state" style={{ padding: '2rem', marginBottom: '1.5rem' }}>
                  <Info className="empty-state-icon" />
                  <div style={{ fontWeight: 700 }}>Sin billeteras</div>
                  <div style={{ fontSize: '0.85rem' }}>Crea tus cuentas iniciales para empezar a registrar movimientos.</div>
                </div>
              ) : (
                <div className="wallets-grid">
                  {wallets.map(wallet => {
                    const { opening, closing } = getWalletBalancesForRange(wallet, portfolioStart, portfolioEnd);
                    const walletDeposits = filteredTransactionsForRange
                      .filter(tx => tx.type === 'DEPOSITO' && tx.wallet_to === wallet.id)
                      .reduce((sum, tx) => sum + tx.amount_in, 0);
                    const walletWithdrawals = filteredTransactionsForRange
                      .filter(tx => tx.type === 'RETIRO' && tx.wallet_from === wallet.id)
                      .reduce((sum, tx) => sum + tx.amount_out, 0);
                    const walletProfit = closing - opening - walletDeposits + walletWithdrawals;

                    return (
                      <div key={wallet.id} className="wallet-card" style={{ '--wallet-color': wallet.color } as CSSProperties}>
                        <div className="wallet-card-header">
                          <div>
                            <div className="wallet-name">{wallet.name}</div>
                            <span className="wallet-platform-badge">{wallet.platform}</span>
                          </div>
                          {!wallet.is_active && <span className="badge badge-platform">Inactiva</span>}
                        </div>
                        <div className="wallet-balance-row">
                          <span className="wallet-balance-val">{closing.toFixed(wallet.currency === 'VES' ? 0 : 2)}</span>
                          <span className="wallet-balance-curr">{wallet.currency}</span>
                        </div>
                        <div className="metric-desc" style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
                          <span>Inicial: {opening.toFixed(wallet.currency === 'VES' ? 0 : 2)} {wallet.currency}</span>
                          <span style={{ 
                            fontWeight: 600, 
                            color: walletProfit > 0.0001 ? 'var(--color-success-hover)' : walletProfit < -0.0001 ? 'var(--color-danger)' : 'var(--text-muted)' 
                          }}>
                            Profit: {walletProfit > 0.0001 ? '+' : ''}{walletProfit.toFixed(wallet.currency === 'VES' ? 0 : 2)} {wallet.currency}
                          </span>
                        </div>
                        <div className="wallet-card-actions">
                          <button className="btn btn-secondary" style={{ padding: '0.35rem' }} onClick={() => handleOpenWalletModal(wallet)} title="Editar">
                            <Edit3 style={{ width: '0.9rem', height: '0.9rem' }} />
                          </button>
                          {wallet.is_active ? (
                            <button className="btn btn-secondary" style={{ padding: '0.35rem' }} onClick={() => handleDeactivateWallet(wallet)} title="Desactivar">
                              <X style={{ width: '0.9rem', height: '0.9rem' }} />
                            </button>
                          ) : (
                            <button className="btn btn-danger" style={{ padding: '0.35rem' }} onClick={() => handleDeleteWallet(wallet)} title="Eliminar">
                              <Trash2 style={{ width: '0.9rem', height: '0.9rem' }} />
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              <div className="tx-separator"></div>

              <h3 className="card-title" style={{ fontSize: '1.05rem', marginBottom: '1rem' }}>Registrar Movimiento</h3>
              <div className="form-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
                <div className="form-group">
                  <label className="form-label">Billetera Origen</label>
                  <select className="form-input" value={txWalletFrom} onChange={(e) => setTxWalletFrom(e.target.value)}>
                    <option value="">Externo / Depósito</option>
                    {activeWallets.map(wallet => (
                      <option key={wallet.id} value={wallet.id}>{wallet.name} - {wallet.balance.toFixed(2)} {wallet.currency}</option>
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
                  <select className="form-input" value={txTypeOverride} onChange={(e) => setTxTypeOverride(e.target.value as Transaction['type'] | 'AUTO')}>
                    <option value="AUTO">Auto: {transactionType}</option>
                    <option value="VENTA_P2P">VENTA_P2P</option>
                    <option value="COMPRA_P2P">COMPRA_P2P</option>
                    <option value="DEPOSITO">DEPOSITO</option>
                    <option value="RETIRO">RETIRO</option>
                    <option value="TRANSFERENCIA">TRANSFERENCIA</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Fecha de Operación</label>
                  <input 
                    type="datetime-local" 
                    className="form-input" 
                    style={{ padding: '0.5rem 0.75rem', fontSize: '0.9rem' }}
                    value={txDate} 
                    onChange={(e) => setTxDate(e.target.value)} 
                  />
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
                  <label className="form-label">Comisión %</label>
                  <input type="number" className="form-input" value={txCommission} onChange={(e) => setTxCommission(parseFloat(e.target.value) || 0)} onFocus={(e) => e.target.select()} min="0" step="0.05" />
                </div>
                <div className="form-group">
                  <label className="form-label">Monto que entra <span className="suffix">{selectedWalletTo?.currency || 'Destino'}</span></label>
                  <input
                    type="number"
                    className="form-input"
                    value={txManualAmountIn || txAmountInDisplay}
                    onChange={(e) => setTxManualAmountIn(e.target.value)}
                    onFocus={(e) => e.target.select()}
                    min="0"
                    step="0.001"
                  />
                  <span className="metric-desc">Sugerido: {txAmountInDisplay} {selectedWalletTo?.currency || ''}</span>
                </div>
              </div>

              <div className="form-group" style={{ marginBottom: '1rem' }}>
                <label className="form-label">Notas</label>
                <input className="form-input" value={txNotes} onChange={(e) => setTxNotes(e.target.value)} onFocus={(e) => e.target.select()} placeholder="Referencia, contraparte o detalle de la operación" />
              </div>
              <button className="btn btn-primary" onClick={handleSaveTransaction}>
                <CheckCircle style={{ width: '1rem', height: '1rem' }} />
                Registrar Movimiento
              </button>

              <div className="ledger-container">
                <div className="ledger-filter-row">
                  <h3 className="card-title" style={{ fontSize: '1.05rem', marginBottom: 0 }}>Historial de Movimientos</h3>
                  <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'nowrap', alignItems: 'center' }}>
                    <select className="form-input" style={{ width: 'auto', minWidth: '180px' }} value={ledgerWalletFilter} onChange={(e) => setLedgerWalletFilter(e.target.value)}>
                      <option value="">Todas las billeteras</option>
                      {wallets.map(wallet => (
                        <option key={wallet.id} value={wallet.id}>{wallet.name}</option>
                      ))}
                    </select>
                    
                    <select className="form-input" style={{ width: 'auto', minWidth: '120px' }} value={ledgerLimit} onChange={(e) => setLedgerLimit(e.target.value)}>
                      <option value="5">Últimos 5</option>
                      <option value="10">Últimos 10</option>
                      <option value="20">Últimos 20</option>
                      <option value="all">Ver todos</option>
                    </select>
                  </div>
                </div>

                <div className="table-responsive">
                  <table className="custom-table">
                    <thead>
                      <tr>
                        <th>Fecha</th>
                        <th>Tipo</th>
                        <th>Ruta</th>
                        <th>Sale</th>
                        <th>Entra</th>
                        <th>Tasa</th>
                        <th>Comisión</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {displayedTransactions.length === 0 ? (
                        <tr>
                          <td colSpan={8} style={{ textAlign: 'center', color: 'var(--text-muted)' }}>Sin movimientos registrados.</td>
                        </tr>
                      ) : (
                        displayedTransactions.map(tx => (
                          <tr key={tx.id}>
                            <td>{new Date(tx.date).toLocaleString()}</td>
                            <td><span className={`tx-badge ${tx.type.toLowerCase().replace('_p2p', '')}`}>{tx.type.replace('_P2P', '')}</span></td>
                            <td>
                              <div className="tx-route-col">
                                <span>{tx.wallet_from_name || 'Externo'}</span>
                                <ArrowRight className="tx-route-arrow" style={{ width: '0.9rem', height: '0.9rem' }} />
                                <span>{tx.wallet_to_name || 'Externo'}</span>
                              </div>
                            </td>
                            <td className="tx-amount-out">-{tx.amount_out.toFixed(2)} {tx.wallet_from_currency || ''}</td>
                            <td className="tx-amount-in">+{tx.amount_in.toFixed(2)} {tx.wallet_to_currency || ''}</td>
                            <td>{tx.rate.toFixed(4)}</td>
                            <td>{tx.commission_pct.toFixed(2)}%</td>
                            <td>
                              <button className="btn btn-danger" style={{ padding: '0.3rem' }} onClick={() => handleDeleteTransaction(tx)} title="Eliminar">
                                <Trash2 style={{ width: '0.85rem', height: '0.85rem' }} />
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'taxes' && (
            <div className="card">
              <div className="card-title">
                <DollarSign className="logo-icon" style={{ width: '1.5rem', height: '1.5rem', color: 'var(--color-primary)' }} />
                Estimación Fiscal {year} — Venezuela ISLR
              </div>
              <div className="card-subtitle">
                Cálculo anualizado estimado del Impuesto Sobre La Renta para el comercio P2P de criptoactivos en Venezuela. 
                <span style={{ color: 'var(--color-primary)', fontWeight: 600 }}> (Solo incluye operaciones en VES)</span>
              </div>

              {/* Fiscal Configuration Header */}
              <div className="fiscal-header">
                <div className="fiscal-inputs">
                  <div className="fiscal-select-wrapper">
                    <span className="calendar-stat-label" style={{ alignSelf: 'flex-start', marginBottom: '0.2rem' }}>País / Sistema</span>
                    <select className="fiscal-select">
                      <option value="venezuela">Venezuela — ISLR</option>
                    </select>
                  </div>
                  
                  <div className="form-group" style={{ gap: '0.2rem' }}>
                    <span className="calendar-stat-label">Tasa BCV (Bs./USDT)</span>
                    <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                      <input 
                        type="number" 
                        className="form-input" 
                        style={{ padding: '0.4rem 0.75rem', fontSize: '0.85rem', width: '110px', fontWeight: 600 }}
                        value={tasaBcv}
                        onChange={(e) => setTasaBcv(parseFloat(e.target.value) || 0)}
                        onFocus={(e) => e.target.select()}
                        step="0.01"
                        min="0.01"
                      />
                      <button 
                        className="btn btn-secondary" 
                        onClick={handleFetchBcvRate}
                        disabled={isFetchingBcv}
                        title="Actualizar tasa desde el BCV"
                        style={{ padding: '0.4rem 0.6rem', display: 'flex', alignItems: 'center', justifyContent: 'center', height: '31px', minWidth: '36px' }}
                      >
                        <RefreshCw style={{ width: '0.9rem', height: '0.9rem' }} className={isFetchingBcv ? 'spin-animation' : ''} />
                      </button>
                    </div>
                  </div>

                  <div className="form-group" style={{ gap: '0.2rem' }}>
                    <span className="calendar-stat-label">Valor UT (Bs./UT)</span>
                    <input 
                      type="number" 
                      className="form-input" 
                      style={{ padding: '0.4rem 0.75rem', fontSize: '0.85rem', width: '110px', fontWeight: 600 }}
                      value={valorUt}
                      onChange={(e) => setValorUt(parseFloat(e.target.value) || 0)}
                      onFocus={(e) => e.target.select()}
                      step="0.1"
                      min="0.01"
                    />
                  </div>
                </div>

                <div className="calendar-stat-item">
                  <span className="calendar-stat-label">Profit Gravable (VES)</span>
                  <span className="calendar-stat-value profit" style={{ fontSize: '1.5rem' }}>
                    +{yearProfitUsdt.toFixed(2)} USDT
                  </span>
                </div>
              </div>

              {/* Income Threshold Banner */}
              {isBelowDeclaringLimit ? (
                <div className="fiscal-alert success">
                  <Info style={{ width: '1.25rem', height: '1.25rem', flexShrink: 0 }} />
                  <div>
                    <strong>Bajo el mínimo de 1.000 UT — No obligado a declarar.</strong> Tus ganancias totales anuales de <strong>{profitInUt.toFixed(2)} UT</strong> están por debajo del límite mínimo establecido de 1,000 UT. No estás legalmente obligado a realizar pago de ISLR según la tarifa N° 1.
                  </div>
                </div>
              ) : (
                <div className="fiscal-alert warning">
                  <Info style={{ width: '1.25rem', height: '1.25rem', flexShrink: 0 }} />
                  <div>
                    <strong>Obligación de Declaración Activa.</strong> Tus ingresos netos de <strong>{profitInUt.toFixed(2)} UT</strong> exceden las 1,000 UT anuales. Debes presentar tu declaración estimada y definitiva de ISLR.
                  </div>
                </div>
              )}

              {/* Metrics Row */}
              <div className="metrics-grid" style={{ marginBottom: '1.5rem' }}>
                <div className="metric-card success">
                  <div className="metric-label">Profit Real VES</div>
                  <div className="metric-value">{yearProfitUsdt.toFixed(2)} USDT</div>
                  <div className="metric-desc">Suma acumulada gravable del año {year}</div>
                </div>
                <div className="metric-card accent">
                  <div className="metric-label">En Bolívares</div>
                  <div className="metric-value">Bs. {profitInBoli.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                  <div className="metric-desc">Tasa BCV de cambio: {tasaBcv} Bs/USDT</div>
                </div>
                <div className="metric-card success">
                  <div className="metric-label">En Unidades Tributarias (UT)</div>
                  <div className="metric-value">{profitInUt.toFixed(2)} UT</div>
                  <div className="metric-desc">Valor UT de referencia: Bs. {valorUt}</div>
                </div>
                <div className="metric-card warning" style={{ borderLeft: '4px solid var(--color-danger)' }}>
                  <div className="metric-label" style={{ color: 'var(--color-danger)' }}>ISLR Estimado a Pagar</div>
                  <div className="metric-value" style={{ color: 'var(--color-danger)' }}>
                    ${taxOwedUsdt.toFixed(2)}
                    <span style={{ fontSize: '0.8rem', marginLeft: '0.25rem', fontWeight: 500 }}>USDT</span>
                  </div>
                  <div className="metric-desc">Bs. {taxOwedBoli.toFixed(2)} (~{taxOwedUt.toFixed(1)} UT)</div>
                </div>
              </div>

              {/* Extra metric for information */}
              <div style={{ padding: '0.85rem 1.25rem', backgroundColor: 'var(--bg-app)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>
                  <CheckCircle style={{ width: '1rem', height: '1rem', display: 'inline', color: 'var(--color-primary)', marginRight: '0.5rem', verticalAlign: 'text-bottom' }} />
                  <strong>Separación de Carteras:</strong> El sistema detectó <strong>${yearUsdProfitTotal.toFixed(2)} USDT</strong> de ganancias puras en USD (Zinli, Wally) que <strong>fueron excluidas</strong> de este cálculo fiscal.
                </span>
                <span style={{ fontWeight: 700, color: 'var(--color-primary)' }}>Excluido: ${yearUsdProfitTotal.toFixed(2)} USD</span>
              </div>

              {/* SENIAT Tariff Table */}
              <h3 className="card-title" style={{ fontSize: '1.05rem', borderTop: '1px solid var(--border-color)', paddingTop: '1.5rem', marginBottom: '1rem' }}>
                Tarifa N° 1 SENIAT (Personas Naturales Residentes)
              </h3>
              
              <div className="table-responsive">
                <table className="custom-table">
                  <thead>
                    <tr>
                      <th>Fracción de Renta (UT)</th>
                      <th>Alícuota / Tasa (%)</th>
                      <th>Sustraendo (UT)</th>
                      <th>Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {islrBrackets.map((bracket, idx) => {
                      const isActive = idx === activeBracketIndex;
                      
                      return (
                        <tr key={idx} className={isActive ? 'fiscal-bracket-row active-bracket' : ''}>
                          <td>{bracket.label}</td>
                          <td style={{ fontWeight: 700 }}>{(bracket.rate * 100).toFixed(0)}%</td>
                          <td>{bracket.sustraendoUt} UT</td>
                          <td>
                            {isActive ? (
                              <span style={{ 
                                backgroundColor: isBelowDeclaringLimit ? 'var(--color-success-light)' : 'rgba(239, 68, 68, 0.1)', 
                                color: isBelowDeclaringLimit ? 'var(--color-success-hover)' : 'var(--color-danger)', 
                                padding: '0.2rem 0.5rem', 
                                borderRadius: '9999px',
                                fontSize: '0.75rem',
                                fontWeight: 700
                              }}>
                                {isBelowDeclaringLimit ? 'ACTIVO (EXENTO)' : 'ACTIVO (SUJETO)'}
                              </span>
                            ) : (
                              <span style={{ color: 'var(--text-muted-light)', fontSize: '0.75rem' }}>-</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Right Column: History Sidebar */}
        {(activeTab === 'operative' || activeTab === 'buy_prices') && (
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
                    Las simulaciones que guardes se sincronizarán con SQLite.
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
                    <div 
                      key={sim.id} 
                      className={`history-card ${isSelected ? 'active' : ''}`}
                      onClick={() => handleLoadSimulation(sim)}
                    >
                      <div className="history-card-header">
                        <span className="history-card-title">{sim.label}</span>
                        <span className="history-card-date">
                          {new Date(sim.created_at).toLocaleDateString()}
                        </span>
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
                        <button 
                          className="btn btn-danger" 
                          style={{ padding: '0.3rem 0.5rem', fontSize: '0.75rem' }}
                          onClick={(e) => handleDelete(sim.id, e)}
                        >
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
        )}
      </main>

      {/* Save Simulation Modal */}
      {isSaveModalOpen && (
        <div className="modal-overlay" onClick={() => setIsSaveModalOpen(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3 className="modal-header">Guardar Simulación P2P</h3>
            <div className="form-group" style={{ marginBottom: '1.5rem' }}>
              <label className="form-label">Nombre de la Simulación</label>
              <input 
                type="text" 
                className="form-input" 
                value={saveLabel}
                onChange={(e) => setSaveLabel(e.target.value)}
                onFocus={(e) => e.target.select()}
                placeholder="Ej. Binance ARS - Banco Galicia"
                autoFocus
              />
            </div>
            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
              <button className="btn btn-secondary" onClick={() => setIsSaveModalOpen(false)}>
                Cancelar
              </button>
              <button className="btn btn-primary" onClick={handleSave}>
                Guardar en SQLite
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Wallet Create/Edit Modal */}
      {isWalletModalOpen && (
        <div className="modal-overlay" onClick={() => setIsWalletModalOpen(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3 className="modal-header">{editingWallet ? 'Editar Billetera' : 'Nueva Billetera'}</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '1.5rem' }}>
              <div className="form-group">
                <label className="form-label">Nombre</label>
                <input
                  className="form-input"
                  value={walletForm.name}
                  onChange={(e) => setWalletForm({ ...walletForm, name: e.target.value })}
                  onFocus={(e) => e.target.select()}
                  placeholder="Binance USDT"
                  autoFocus
                />
              </div>
              <div className="form-group">
                <label className="form-label">Plataforma</label>
                <input
                  className="form-input"
                  value={walletForm.platform}
                  onChange={(e) => setWalletForm({ ...walletForm, platform: e.target.value })}
                  onFocus={(e) => e.target.select()}
                  placeholder="Binance, Zinli, Banesco"
                />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem' }}>
                <div className="form-group">
                  <label className="form-label">Moneda</label>
                  <select
                    className="form-input"
                    value={walletForm.currency}
                    onChange={(e) => setWalletForm({ ...walletForm, currency: e.target.value as Wallet['currency'] })}
                  >
                    <option value="USDT">USDT</option>
                    <option value="USD">USD</option>
                    <option value="VES">VES</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Saldo actual</label>
                  <input
                    type="number"
                    className="form-input"
                    value={walletForm.balance}
                    onChange={(e) => {
                      const nextBalance = parseFloat(e.target.value) || 0;
                      setWalletForm({
                        ...walletForm,
                        balance: nextBalance,
                        opening_balance: editingWallet ? walletForm.opening_balance : nextBalance
                      });
                    }}
                    onFocus={(e) => e.target.select()}
                    step="0.01"
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Capital inicial</label>
                  <input
                    type="number"
                    className="form-input"
                    value={walletForm.opening_balance}
                    onChange={(e) => setWalletForm({ ...walletForm, opening_balance: parseFloat(e.target.value) || 0 })}
                    onFocus={(e) => e.target.select()}
                    step="0.01"
                  />
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', alignItems: 'end' }}>
                <div className="form-group">
                  <label className="form-label">Color</label>
                  <input
                    type="color"
                    className="form-input"
                    value={walletForm.color}
                    onChange={(e) => setWalletForm({ ...walletForm, color: e.target.value })}
                    style={{ height: '42px', padding: '0.2rem' }}
                  />
                </div>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 600, color: 'var(--text-muted)' }}>
                  <input
                    type="checkbox"
                    checked={walletForm.is_active}
                    onChange={(e) => setWalletForm({ ...walletForm, is_active: e.target.checked })}
                    style={{ accentColor: 'var(--color-primary)' }}
                  />
                  Activa
                </label>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
              <button className="btn btn-secondary" onClick={() => setIsWalletModalOpen(false)}>
                Cancelar
              </button>
              <button className="btn btn-primary" onClick={handleSaveWallet}>
                Guardar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Close Operative / Log to Logbook Modal */}
      {isCloseOperativeModalOpen && (
        <div className="modal-overlay" onClick={() => setIsCloseOperativeModalOpen(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3 className="modal-header">Cerrar Operativa en Bitácora</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '1.5rem' }}>
              <div className="form-group">
                <label className="form-label">Fecha de Registro</label>
                <input 
                  type="date" 
                  className="form-input" 
                  value={closeOperativeDate}
                  onChange={(e) => setCloseOperativeDate(e.target.value)}
                  onFocus={(e) => e.target.select()}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div className="form-group">
                  <label className="form-label">Volumen Total (USDT)</label>
                  <input 
                    type="number" 
                    className="form-input" 
                    value={capital * ciclosDia}
                    disabled
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Ganancia Total (USDT)</label>
                  <input 
                    type="number" 
                    className="form-input" 
                    value={calculationResult.ganancia_diaria.toFixed(2)}
                    disabled
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div className="form-group">
                  <label className="form-label">Método Compra</label>
                  <input type="text" className="form-input" value={metodoCompra} disabled />
                </div>
                <div className="form-group">
                  <label className="form-label">Método Venta</label>
                  <input type="text" className="form-input" value={metodoVenta} disabled />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Notas</label>
                <textarea 
                  className="form-input" 
                  style={{ minHeight: '60px', resize: 'vertical' }}
                  value={closeOperativeNotes}
                  onChange={(e) => setCloseOperativeNotes(e.target.value)}
                  onFocus={(e) => e.target.select()}
                />
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <input 
                  type="checkbox" 
                  id="accumulate-check"
                  checked={closeOperativeAccumulate}
                  onChange={(e) => setCloseOperativeAccumulate(e.target.checked)}
                  style={{ accentColor: 'var(--color-primary)' }}
                />
                <label htmlFor="accumulate-check" style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', cursor: 'pointer' }}>
                  Acumular si ya existe registro de igual método
                </label>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
              <button className="btn btn-secondary" onClick={() => setIsCloseOperativeModalOpen(false)}>
                Cancelar
              </button>
              <button className="btn btn-primary" onClick={handleCloseOperativeSave}>
                Registrar Cierre
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Day Log Details & Add Operation Modal */}
      {isLogModalOpen && selectedDateStr && (
        <div className="modal-overlay" onClick={() => setIsLogModalOpen(false)}>
          <div className="modal-content" style={{ maxWidth: '550px' }} onClick={(e) => e.stopPropagation()}>
            <h3 className="modal-header">Bitácora: {selectedDateStr}</h3>
            
            {/* List of operations on this day */}
            <h4 className="form-label" style={{ marginBottom: '0.5rem' }}>Operaciones Registradas ({activeDayLogs.length})</h4>
            {activeDayLogs.length === 0 ? (
              <div className="empty-state" style={{ padding: '1.5rem', marginBottom: '1.5rem' }}>
                <span style={{ fontSize: '0.8rem' }}>No hay operaciones registradas para este día. Usa el formulario de abajo para agregar una.</span>
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
                          <button 
                            className="btn btn-danger" 
                            style={{ padding: '0.25rem 0.4rem', borderRadius: '4px' }}
                            onClick={() => log.id && handleDeleteLogItem(log.id)}
                            title="Eliminar operación"
                          >
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

            {/* Form to add a new operation */}
            <h4 className="form-label" style={{ marginBottom: '0.75rem', color: 'var(--color-primary)' }}>
              Agregar Operación Manual
            </h4>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1.5rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div className="form-group">
                  <label className="form-label">Tipo Operativa</label>
                  <select 
                    className="form-input" 
                    value={newLogType}
                    onChange={(e) => setNewLogType(e.target.value)}
                    style={{ padding: '0.4rem 0.75rem' }}
                  >
                    <option value="USD">USD (Zinli, Wally)</option>
                    <option value="VES">VES (Banco locales)</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Notas</label>
                  <input 
                    type="text" 
                    className="form-input"
                    value={newLogNotes}
                    onChange={(e) => setNewLogNotes(e.target.value)}
                    onFocus={(e) => e.target.select()}
                    placeholder="Nota rápida"
                    style={{ padding: '0.4rem 0.75rem' }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div className="form-group">
                  <label className="form-label">Método Compra (Zinli, etc)</label>
                  <input 
                    type="text" 
                    className="form-input" 
                    value={newLogMetCompra}
                    onChange={(e) => setNewLogMetCompra(e.target.value)}
                    onFocus={(e) => e.target.select()}
                    style={{ padding: '0.4rem 0.75rem' }}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Método Venta (Banesco, etc)</label>
                  <input 
                    type="text" 
                    className="form-input" 
                    value={newLogMetVenta}
                    onChange={(e) => setNewLogMetVenta(e.target.value)}
                    onFocus={(e) => e.target.select()}
                    style={{ padding: '0.4rem 0.75rem' }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div className="form-group">
                  <label className="form-label">Volumen (USDT)</label>
                  <input 
                    type="number" 
                    className="form-input" 
                    value={newLogVolume}
                    onChange={(e) => setNewLogVolume(parseFloat(e.target.value) || 0)}
                    onFocus={(e) => e.target.select()}
                    style={{ padding: '0.4rem 0.75rem' }}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Profit (USDT)</label>
                  <input 
                    type="number" 
                    className="form-input" 
                    value={newLogProfit}
                    onChange={(e) => setNewLogProfit(parseFloat(e.target.value) || 0)}
                    onFocus={(e) => e.target.select()}
                    step="1"
                    style={{ padding: '0.4rem 0.75rem' }}
                  />
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
              <button className="btn btn-secondary" onClick={() => setIsLogModalOpen(false)}>
                Cerrar Ventana
              </button>
              <button className="btn btn-primary" onClick={handleSaveNewOperation}>
                Añadir Operación
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
