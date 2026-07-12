import { useState, useEffect } from 'react';
import { ArrowRightLeft, CheckCircle, Loader2, ArrowUpCircle } from 'lucide-react';
import { applyUpdate, getUpdateProgress, fetchBcvRate, resetDatabaseSecure, saveLog, API_BASE_URL } from './api';
import type { SavedCalculation, Wallet, Transaction, UpdateProgress } from './api';

import { useAppData } from './hooks/useAppData';
import { useCalculator } from './hooks/useCalculator';
import { usePortfolio } from './hooks/usePortfolio';
import { useLogbook } from './hooks/useLogbook';

import { OperativeTab } from './components/OperativeTab';
import { BuyPricesTab } from './components/BuyPricesTab';
import { LogbookTab } from './components/LogbookTab';
import { PortfolioTab } from './components/PortfolioTab';
import { TaxesTab } from './components/TaxesTab';
import { HistorySidebar } from './components/HistorySidebar';
import { SaveSimulationModal } from './components/SaveSimulationModal';
import { WalletModal } from './components/WalletModal';
import { CloseOperativeModal } from './components/CloseOperativeModal';
import { LogDayModal } from './components/LogDayModal';

function App() {
  const [activeTab, setActiveTab] = useState<'operative' | 'buy_prices' | 'portfolio' | 'logbook' | 'taxes'>('operative');
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'info' } | null>(null);
  const [updating, setUpdating] = useState<boolean>(false);
  const [updateProgress, setUpdateProgress] = useState<UpdateProgress | null>(null);
  const [reconnecting, setReconnecting] = useState<boolean>(false);
  const [isFetchingBcv, setIsFetchingBcv] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [tasaBcv, setTasaBcv] = useState<number>(() => {
    const local = localStorage.getItem('p2p_tasa_bcv');
    return local ? parseFloat(local) : 0;
  });
  const [valorUt, setValorUt] = useState<number>(() => {
    const local = localStorage.getItem('p2p_valor_ut');
    return local ? parseFloat(local) : 0;
  });

  // Buy prices state
  const [precioVenta, setPrecioVenta] = useState<number>(0);
  const [comisionP2P, setComisionP2P] = useState<number>(0);
  const [percentPersonalizado, setPercentPersonalizado] = useState<number>(0);

  // Save simulation modal
  const [isSaveModalOpen, setIsSaveModalOpen] = useState(false);
  const [saveLabel, setSaveLabel] = useState('');

  useEffect(() => {
    localStorage.setItem('p2p_tasa_bcv', tasaBcv.toString());
  }, [tasaBcv]);

  useEffect(() => {
    localStorage.setItem('p2p_valor_ut', valorUt.toString());
  }, [valorUt]);

  const showNotification = (message: string, type: 'success' | 'info' = 'success') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 4000);
  };

  const appData = useAppData();
  const calc = useCalculator();
  const logbook = useLogbook(appData.logs, () => appData.loadData(tasaBcv));
  const portfolio = usePortfolio(
    appData.wallets,
    appData.transactions,
    () => appData.loadData(tasaBcv),
  );

  useEffect(() => {
    appData.loadData(tasaBcv).then(() => setIsLoading(false));
    const autoFetchBcv = async () => {
      try {
        const rate = await fetchBcvRate();
        setTasaBcv(prev => prev === 0 ? rate : prev);
      } catch { /* ignore */ }
    };
    autoFetchBcv();
    const interval = setInterval(() => appData.loadData(tasaBcv), 30000);
    return () => clearInterval(interval);
  }, []);

  const handleApplyUpdate = async () => {
    if (!confirm('Se descargará y aplicará la nueva versión. El servidor se reiniciará. ¿Continuar?')) return;
    setUpdating(true);
    setUpdateProgress({ status: 'downloading', progress: 0, error_message: null });

    try {
      const result = await applyUpdate();
      if (!result || !result.success) {
        setUpdateProgress({ status: 'error', progress: 0, error_message: 'No se pudo iniciar la descarga de actualización.' });
        setUpdating(false);
        return;
      }

      const pollInterval = setInterval(async () => {
        try {
          const prog = await getUpdateProgress();
          if (prog) {
            setUpdateProgress(prog);

            if (prog.status === 'ready') {
              clearInterval(pollInterval);
              setReconnecting(true);
              
              // Wait 4 seconds for the server to stop, then poll availability
              setTimeout(() => {
                const reconnectInterval = setInterval(async () => {
                  try {
                    const testResp = await fetch(`${API_BASE_URL}/update-check/`);
                    if (testResp.ok) {
                      clearInterval(reconnectInterval);
                      setReconnecting(false);
                      setUpdating(false);
                      setUpdateProgress(null);
                      alert('¡Actualización aplicada con éxito! La aplicación se recargará automáticamente.');
                      window.location.reload();
                    }
                  } catch {
                    // Keep trying
                  }
                }, 2000);
              }, 4000);
            } else if (prog.status === 'error') {
              clearInterval(pollInterval);
              setUpdating(false);
            }
          }
        } catch {
          // Ignore network errors during restart window
        }
      }, 800);

    } catch {
      setUpdateProgress({ status: 'error', progress: 0, error_message: 'Error de conexión al iniciar actualización.' });
      setUpdating(false);
    }
  };

  const handleFetchBcvRate = async () => {
    if (isFetchingBcv) return;
    setIsFetchingBcv(true);
    try {
      const rate = await fetchBcvRate();
      setTasaBcv(rate);
      showNotification(`Tasa BCV obtenida: ${rate.toFixed(4)} Bs./USD`, 'success');
    } catch (e: any) {
      showNotification(e.message || 'No se pudo obtener la tasa desde el BCV', 'info');
    } finally {
      setIsFetchingBcv(false);
    }
  };

  const handleResetSystem = async () => {
    if (!confirm('¿Estas seguro de que deseas restablecer por completo el sistema? Esto eliminara permanentemente todas las billeteras, movimientos, bitacoras e historial.')) return;
    try { await resetDatabaseSecure(); } catch { /* ignore */ }
    localStorage.clear();
    window.location.reload();
  };

  const handleOpenSaveModal = () => {
    setSaveLabel(calc.defaultLabel);
    setIsSaveModalOpen(true);
  };

  const handleSaveSimulation = async () => {
    const ok = await calc.handleSaveSimulation(saveLabel);
    if (ok) {
      setIsSaveModalOpen(false);
      appData.loadData(tasaBcv);
      showNotification('Simulacion guardada exitosamente');
    }
  };

  const handleDeleteSimulation = async (id: number) => {
    const ok = await calc.handleDeleteSimulation(id);
    if (ok) {
      appData.loadData(tasaBcv);
      showNotification('Simulacion eliminada');
    }
  };

  const handleLoadSimulation = (sim: SavedCalculation) => {
    calc.handleLoadSimulation(sim);
    setActiveTab('operative');
    showNotification('Cargada simulacion: ' + sim.label, 'info');
  };

  const handleLogDayClick = (dateStr: string) => {
    logbook.handleDayClick(
      dateStr,
      calc.tipoOperativa,
      calc.plataformaCompra,
      calc.plataformaVenta,
      calc.metodoCompra,
      calc.metodoVenta,
      calc.comisionCompra,
      calc.comisionVenta,
      calc.capital,
      calc.calculationResult.ganancia_ciclo,
    );
  };

  const handleSaveNewOperation = async () => {
    await logbook.handleSaveNewOperation(showNotification);
  };

  const handleDeleteLogItem = async (id: number) => {
    await logbook.handleDeleteLogItem(id, showNotification);
  };

  const handleCloseOperativeSave = async () => {
    try {
      await saveLog({
        date: logbook.closeOperativeDate,
        profit: calc.calculationResult.ganancia_diaria,
        volume: calc.capital * calc.ciclosDia,
        notes: logbook.closeOperativeNotes,
        imported: true,
        tipo_operativa: calc.tipoOperativa,
        plataforma_compra: calc.plataformaCompra,
        plataforma_venta: calc.plataformaVenta,
        comision_compra: calc.comisionCompra,
        comision_venta: calc.comisionVenta,
        metodo_compra: calc.metodoCompra,
        metodo_venta: calc.metodoVenta,
        accumulate: logbook.closeOperativeAccumulate,
      });
      logbook.setIsCloseOperativeModalOpen(false);
      appData.loadData(tasaBcv);
      showNotification('Operativa registrada en la bitacora');
    } catch { /* ignore */ }
  };

  const handleSaveWallet = async () => {
    await portfolio.handleSaveWallet(showNotification);
  };

  const handleDeactivateWallet = async (wallet: Wallet) => {
    await portfolio.handleDeactivateWallet(wallet, showNotification);
  };

  const handleDeleteWallet = async (wallet: Wallet) => {
    await portfolio.handleDeleteWallet(wallet, showNotification);
  };

  const handleSaveTransaction = async () => {
    await portfolio.handleSaveTransaction(tasaBcv, showNotification);
  };

  const handleDeleteTransaction = async (tx: Transaction) => {
    await portfolio.handleDeleteTransaction(tx, showNotification);
  };

  return (
    <div className="app-container">
      {isLoading && (
        <div style={{
          position: 'fixed', inset: 0, backgroundColor: 'var(--bg-app)',
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          zIndex: 9999, gap: '1rem',
        }}>
          <Loader2 style={{ width: '2.5rem', height: '2.5rem', color: 'var(--color-primary)', animation: 'spin 1s linear infinite' }} />
          <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>Cargando datos...</span>
        </div>
      )}

      {notification && (
        <div style={{
          position: 'fixed', bottom: '2rem', right: '2rem',
          backgroundColor: notification.type === 'success' ? 'var(--color-success)' : 'var(--color-primary)',
          color: '#ffffff', padding: '0.85rem 1.5rem', borderRadius: 'var(--radius-sm)',
          boxShadow: 'var(--shadow-lg)', display: 'flex', alignItems: 'center', gap: '0.5rem',
          fontWeight: 600, fontSize: '0.9rem', zIndex: 200, animation: 'modalSlide 0.2s ease-out',
        }}>
          <CheckCircle style={{ width: '1.2rem', height: '1.2rem' }} />
          {notification.message}
        </div>
      )}

      <header className="header">
        <div className="logo-container">
          <ArrowRightLeft className="logo-icon" />
          <h1 className="logo-text">
            P2P Arbitrage
            <span className="logo-badge">{appData.currentVersion ? `V${appData.currentVersion}` : ''}</span>
          </h1>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div className={`status-badge ${appData.isOnline ? 'online' : 'offline'}`}>
            <span className="status-dot"></span>
            {appData.isOnline ? 'SQLite Conectado' : 'Modo Offline (Local)'}
          </div>
          {appData.updateInfo?.update_available && (
            <button onClick={handleApplyUpdate} disabled={updating} className="status-badge update-badge"
              title={`Actualizar de ${appData.updateInfo.current_version} a ${appData.updateInfo.latest_version}`}>
              <span className="status-dot update-dot"></span>
              {updating ? 'Actualizando...' : `Update v${appData.updateInfo.latest_version}`}
            </button>
          )}
        </div>
      </header>

      <main className={`main-content ${activeTab === 'portfolio' || activeTab === 'logbook' || activeTab === 'taxes' ? 'full-width' : ''}`}>
        <div>
          <div className="tabs-container">
            <button className={`tab-btn ${activeTab === 'operative' ? 'active' : ''}`} onClick={() => setActiveTab('operative')}>Calculo de Operativa</button>
            <button className={`tab-btn ${activeTab === 'buy_prices' ? 'active' : ''}`} onClick={() => setActiveTab('buy_prices')}>Calculadora de Compras</button>
            <button className={`tab-btn ${activeTab === 'logbook' ? 'active' : ''}`} onClick={() => setActiveTab('logbook')}>Bitacora P2P</button>
            <button className={`tab-btn ${activeTab === 'portfolio' ? 'active' : ''}`} onClick={() => setActiveTab('portfolio')}>Portafolio</button>
            <button className={`tab-btn ${activeTab === 'taxes' ? 'active' : ''}`} onClick={() => setActiveTab('taxes')}>Estimacion Fiscal</button>
          </div>

          {activeTab === 'operative' && (
            <OperativeTab
              tipoOperativa={calc.tipoOperativa} setTipoOperativa={calc.setTipoOperativa}
              capital={calc.capital} setCapital={calc.setCapital}
              ciclosDia={calc.ciclosDia} setCiclosDia={calc.setCiclosDia}
              plataformaCompra={calc.plataformaCompra} setPlataformaCompra={calc.setPlataformaCompra}
              metodoCompra={calc.metodoCompra} setMetodoCompra={calc.setMetodoCompra}
              tasaCompra={calc.tasaCompra} setTasaCompra={calc.setTasaCompra}
              comisionCompra={calc.comisionCompra} setComisionCompra={calc.setComisionCompra}
              plataformaVenta={calc.plataformaVenta} setPlataformaVenta={calc.setPlataformaVenta}
              metodoVenta={calc.metodoVenta} setMetodoVenta={calc.setMetodoVenta}
              tasaVenta={calc.tasaVenta} setTasaVenta={calc.setTasaVenta}
              comisionVenta={calc.comisionVenta} setComisionVenta={calc.setComisionVenta}
              calculationResult={calc.calculationResult}
              onOpenSaveModal={handleOpenSaveModal}
              onOpenCloseOperative={() => {
                logbook.setCloseOperativeNotes(`Importado de simulador. Compra: ${calc.metodoCompra} (${calc.plataformaCompra}), Venta: ${calc.metodoVenta} (${calc.plataformaVenta}).`);
                logbook.setIsCloseOperativeModalOpen(true);
              }}
              onExport={calc.handleExportText}
            />
          )}

          {activeTab === 'buy_prices' && (
            <BuyPricesTab
              precioVenta={precioVenta} setPrecioVenta={setPrecioVenta}
              comisionP2P={comisionP2P} setComisionP2P={setComisionP2P}
              percentPersonalizado={percentPersonalizado} setPercentPersonalizado={setPercentPersonalizado}
            />
          )}

          {activeTab === 'logbook' && (
            <LogbookTab
              year={logbook.year}
              monthName={logbook.monthName}
              monthVolumeTotal={logbook.monthVolumeTotal}
              monthProfitTotal={logbook.monthProfitTotal}
              calendarDays={logbook.calendarDays}
              onPrevMonth={() => logbook.setCurrentDate(new Date(logbook.currentDate.getFullYear(), logbook.currentDate.getMonth() - 1, 1))}
              onNextMonth={() => logbook.setCurrentDate(new Date(logbook.currentDate.getFullYear(), logbook.currentDate.getMonth() + 1, 1))}
              onDayClick={handleLogDayClick}
              onExportCSV={logbook.handleExportCSV}
            />
          )}

          {activeTab === 'portfolio' && (
            <PortfolioTab
              wallets={appData.wallets}
              portfolioStart={portfolio.portfolioStart}
              portfolioEnd={portfolio.portfolioEnd}
              portfolioDateFilter={portfolio.portfolioDateFilter}
              setPortfolioDateFilter={portfolio.setPortfolioDateFilter}
              getWalletBalancesForRange={portfolio.getWalletBalancesForRange}
              filteredTransactionsForRange={portfolio.filteredTransactionsForRange}
              displayedTransactions={portfolio.displayedTransactions}
              txWalletFrom={portfolio.txWalletFrom} setTxWalletFrom={portfolio.setTxWalletFrom}
              txWalletTo={portfolio.txWalletTo} setTxWalletTo={portfolio.setTxWalletTo}
              txTypeOverride={portfolio.txTypeOverride} setTxTypeOverride={portfolio.setTxTypeOverride}
              transactionType={portfolio.transactionType}
              txDate={portfolio.txDate} setTxDate={portfolio.setTxDate}
              txAmountOut={portfolio.txAmountOut} setTxAmountOut={portfolio.setTxAmountOut}
              txRate={portfolio.txRate} setTxRate={portfolio.setTxRate}
              txCommission={portfolio.txCommission} setTxCommission={portfolio.setTxCommission}
              txManualAmountIn={portfolio.txManualAmountIn} setTxManualAmountIn={portfolio.setTxManualAmountIn}
              txAmountInDisplay={portfolio.txAmountInDisplay}
              txCategory={portfolio.txCategory} setTxCategory={portfolio.setTxCategory}
              txNotes={portfolio.txNotes} setTxNotes={portfolio.setTxNotes}
              ledgerWalletFilter={portfolio.ledgerWalletFilter} setLedgerWalletFilter={portfolio.setLedgerWalletFilter}
              ledgerLimit={portfolio.ledgerLimit} setLedgerLimit={portfolio.setLedgerLimit}
              activeWallets={portfolio.activeWallets}
              selectedWalletFrom={portfolio.selectedWalletFrom}
              selectedWalletTo={portfolio.selectedWalletTo}
              amountToUsdt={appData.amountToUsdt}
              tasaBcv={tasaBcv}
              handleOpenWalletModal={portfolio.handleOpenWalletModal}
              handleDeactivateWallet={handleDeactivateWallet}
              handleDeleteWallet={handleDeleteWallet}
              handleSaveTransaction={handleSaveTransaction}
              handleDeleteTransaction={handleDeleteTransaction}
              handleResetSystem={handleResetSystem}
            />
          )}

          {activeTab === 'taxes' && (
            <TaxesTab
              year={logbook.year}
              tasaBcv={tasaBcv} setTasaBcv={setTasaBcv}
              valorUt={valorUt} setValorUt={setValorUt}
              isFetchingBcv={isFetchingBcv}
              onFetchBcvRate={handleFetchBcvRate}
              logs={appData.logs}
              transactions={appData.transactions}
            />
          )}
        </div>

        {(activeTab === 'operative' || activeTab === 'buy_prices') && (
          <HistorySidebar
            history={appData.history}
            capital={calc.capital}
            comisionCompra={calc.comisionCompra}
            comisionVenta={calc.comisionVenta}
            tasaVenta={calc.tasaVenta}
            tasaCompra={calc.tasaCompra}
            ciclosDia={calc.ciclosDia}
            onLoad={handleLoadSimulation}
            onDelete={handleDeleteSimulation}
          />
        )}
      </main>

      <SaveSimulationModal
        isOpen={isSaveModalOpen}
        onClose={() => setIsSaveModalOpen(false)}
        label={saveLabel}
        setLabel={setSaveLabel}
        onSave={handleSaveSimulation}
      />

      <WalletModal
        isOpen={portfolio.isWalletModalOpen}
        onClose={() => portfolio.setIsWalletModalOpen(false)}
        editingWallet={portfolio.editingWallet}
        walletForm={portfolio.walletForm}
        setWalletForm={portfolio.setWalletForm}
        onSave={handleSaveWallet}
      />

      <CloseOperativeModal
        isOpen={logbook.isCloseOperativeModalOpen}
        onClose={() => logbook.setIsCloseOperativeModalOpen(false)}
        date={logbook.closeOperativeDate}
        setDate={logbook.setCloseOperativeDate}
        notes={logbook.closeOperativeNotes}
        setNotes={logbook.setCloseOperativeNotes}
        accumulate={logbook.closeOperativeAccumulate}
        setAccumulate={logbook.setCloseOperativeAccumulate}
        volume={calc.capital * calc.ciclosDia}
        profit={calc.calculationResult.ganancia_diaria}
        metodoCompra={calc.metodoCompra}
        metodoVenta={calc.metodoVenta}
        onSave={handleCloseOperativeSave}
      />

      <LogDayModal
        isOpen={logbook.isLogModalOpen}
        onClose={() => logbook.setIsLogModalOpen(false)}
        dateStr={logbook.selectedDateStr}
        activeDayLogs={logbook.activeDayLogs}
        newLogType={logbook.newLogType} setNewLogType={logbook.setNewLogType}
        newLogNotes={logbook.newLogNotes} setNewLogNotes={logbook.setNewLogNotes}
        newLogMetCompra={logbook.newLogMetCompra} setNewLogMetCompra={logbook.setNewLogMetCompra}
        newLogMetVenta={logbook.newLogMetVenta} setNewLogMetVenta={logbook.setNewLogMetVenta}
        newLogVolume={logbook.newLogVolume} setNewLogVolume={logbook.setNewLogVolume}
        newLogProfit={logbook.newLogProfit} setNewLogProfit={logbook.setNewLogProfit}
        onSave={handleSaveNewOperation}
        onDeleteLog={handleDeleteLogItem}
      />

      {updateProgress && (
        <div style={{
          position: 'fixed', inset: 0, backgroundColor: 'rgba(15, 23, 42, 0.75)',
          backdropFilter: 'blur(8px)', display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center', zIndex: 10000, padding: '2rem'
        }}>
          <div className="card" style={{ maxWidth: '480px', width: '100%', padding: '2rem', textAlign: 'center', boxShadow: 'var(--shadow-2xl)', border: '1px solid var(--border-color)' }}>
            <ArrowUpCircle style={{ width: '3.5rem', height: '3.5rem', color: 'var(--color-primary)', margin: '0 auto 1.5rem', animation: updateProgress.status !== 'error' && updateProgress.status !== 'ready' ? 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite' : 'none' }} />
            
            <h3 className="card-title" style={{ fontSize: '1.25rem', marginBottom: '0.75rem' }}>
              {reconnecting ? 'Reiniciando Servidor...' : 'Actualizando Aplicación'}
            </h3>
            
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '1.5rem' }}>
              {updateProgress.status === 'downloading' && `Descargando archivos de actualización: ${updateProgress.progress}%`}
              {updateProgress.status === 'verifying' && 'Verificando firma digital y firmas de seguridad (SHA-256)...'}
              {updateProgress.status === 'extracting' && 'Extrayendo paquete de actualización...'}
              {updateProgress.status === 'ready' && 'Instalando archivos y reiniciando servidor...'}
              {updateProgress.status === 'error' && `Error: ${updateProgress.error_message}`}
            </p>

            {updateProgress.status !== 'error' && (
              <div style={{ width: '100%', height: '8px', backgroundColor: 'var(--border-color)', borderRadius: '9999px', overflow: 'hidden', marginBottom: '1rem' }}>
                <div style={{
                  width: `${updateProgress.status === 'downloading' ? updateProgress.progress : 100}%`,
                  height: '100%',
                  backgroundColor: reconnecting ? 'var(--color-success)' : 'var(--color-primary)',
                  transition: 'width 0.3s ease-out',
                  borderRadius: '9999px',
                }} />
              </div>
            )}

            {reconnecting && (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', color: 'var(--color-success)', fontSize: '0.85rem', fontWeight: 600 }}>
                <Loader2 style={{ width: '1rem', height: '1rem', animation: 'spin 1s linear infinite' }} />
                <span>Intentando reconectar...</span>
              </div>
            )}

            {updateProgress.status === 'error' && (
              <button className="btn btn-primary" onClick={() => { setUpdateProgress(null); setUpdating(false); }} style={{ marginTop: '0.5rem' }}>
                Cerrar
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
