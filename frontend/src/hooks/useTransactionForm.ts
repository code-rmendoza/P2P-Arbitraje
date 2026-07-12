import { useState } from 'react';
import { saveTransaction, deleteTransaction } from '../api';
import type { Wallet, Transaction } from '../api';

export function useTransactionForm(
  wallets: Wallet[],
  loadData: () => Promise<void>
) {
  const [txWalletFrom, setTxWalletFrom] = useState<string>('');
  const [txWalletTo, setTxWalletTo] = useState<string>('');
  const [txAmountOut, setTxAmountOut] = useState<number>(0);
  const [txRate, setTxRate] = useState<number>(0);
  const [txCommission, setTxCommission] = useState<number>(0);
  const [txManualAmountIn, setTxManualAmountIn] = useState<string>('');
  const [txCategory, setTxCategory] = useState<string>('');
  const [txNotes, setTxNotes] = useState<string>('');
  const [txDate, setTxDate] = useState<string>(() => getLocalDatetimeString());
  const [txTypeOverride, setTxTypeOverride] = useState<Transaction['type'] | 'AUTO'>('AUTO');

  function getLocalDatetimeString(date = new Date()) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  }

  const selectedWalletFrom = wallets.find(wallet => wallet.id?.toString() === txWalletFrom);
  const selectedWalletTo = wallets.find(wallet => wallet.id?.toString() === txWalletTo);

  const inferTransactionType = (): Transaction['type'] => {
    if (txTypeOverride !== 'AUTO') return txTypeOverride;
    if (selectedWalletFrom?.currency === 'USDT' && selectedWalletTo && selectedWalletTo.currency !== 'USDT') return 'VENTA_P2P';
    if (selectedWalletFrom && selectedWalletFrom.currency !== 'USDT' && selectedWalletTo?.currency === 'USDT') return 'COMPRA_P2P';
    if (!selectedWalletFrom && selectedWalletTo) return 'DEPOSITO';
    if (selectedWalletFrom && !selectedWalletTo) return 'RETIRO';
    return 'TRANSFERENCIA';
  };

  const transactionType = inferTransactionType();

  const calculateTransactionAmountIn = () => {
    if (txAmountOut <= 0) return 0;
    const commissionFactor = 1 - txCommission / 100;
    if (transactionType === 'COMPRA_P2P') return txRate > 0 ? (txAmountOut / txRate) * commissionFactor : 0;
    if (transactionType === 'VENTA_P2P') return txAmountOut * txRate * commissionFactor;
    if (transactionType === 'TRANSFERENCIA') {
      return selectedWalletFrom?.currency === selectedWalletTo?.currency
        ? txAmountOut * commissionFactor
        : txAmountOut * txRate * commissionFactor;
    }
    if (transactionType === 'DEPOSITO' || transactionType === 'INGRESO_EXTERNO') return txAmountOut;
    return 0;
  };

  const txAmountIn = parseFloat(calculateTransactionAmountIn().toFixed(6));
  const txAmountInDisplay = selectedWalletTo?.currency === 'USDT'
    ? txAmountIn.toFixed(3)
    : txAmountIn.toFixed(2);
  const effectiveTxAmountIn = txManualAmountIn.trim() !== ''
    ? parseFloat(txManualAmountIn) || 0
    : txAmountIn;

  const handleSaveTransaction = async (tasaBcv: number, notify: (msg: string) => void) => {
    if (!selectedWalletFrom && !selectedWalletTo) {
      alert('Selecciona al menos una billetera.');
      return;
    }
    if (txWalletFrom && !selectedWalletFrom) {
      alert('La billetera origen no se pudo resolver. Refresca la pagina y vuelve a seleccionarla.');
      return;
    }
    if (txWalletTo && !selectedWalletTo) {
      alert('La billetera destino no se pudo resolver. Refresca la pagina y vuelve a seleccionarla.');
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
      await saveTransaction({
        date: txDate ? new Date(txDate).toISOString() : new Date().toISOString(),
        type: transactionType,
        wallet_from: selectedWalletFrom?.id ?? null,
        wallet_to: selectedWalletTo?.id ?? null,
        amount_out: selectedWalletFrom ? parseFloat(txAmountOut.toFixed(2)) : 0,
        amount_in: selectedWalletTo ? parseFloat(effectiveTxAmountIn.toFixed(2)) : 0,
        rate: txRate,
        commission_pct: txCommission,
        category: ['GASTO', 'INGRESO_EXTERNO'].includes(transactionType) ? (txCategory || 'Otros') : null,
        notes: txNotes,
      }, tasaBcv);

      setTxAmountOut(0);
      setTxRate(1.0);
      setTxManualAmountIn('');
      setTxCategory('');
      setTxNotes('');
      setTxDate(getLocalDatetimeString());
      await loadData();
      notify('Movimiento registrado');
    } catch (error: any) {
      alert(error.message || 'No se pudo registrar el movimiento.');
    }
  };

  const handleDeleteTransaction = async (tx: Transaction, notify: (msg: string) => void) => {
    if (!tx.id || !confirm('¿Eliminar este movimiento y revertir saldos?')) return;

    await deleteTransaction(tx.id);
    await loadData();
    notify('Movimiento eliminado y saldos revertidos');
  };

  return {
    txWalletFrom, setTxWalletFrom,
    txWalletTo, setTxWalletTo,
    txAmountOut, setTxAmountOut,
    txRate, setTxRate,
    txCommission, setTxCommission,
    txManualAmountIn, setTxManualAmountIn,
    txCategory, setTxCategory,
    txNotes, setTxNotes,
    txDate, setTxDate,
    txTypeOverride, setTxTypeOverride,
    selectedWalletFrom,
    selectedWalletTo,
    transactionType,
    txAmountInDisplay,
    effectiveTxAmountIn,
    handleSaveTransaction,
    handleDeleteTransaction,
    getLocalDatetimeString,
  };
}
