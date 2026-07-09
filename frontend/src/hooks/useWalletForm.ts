import { useState } from 'react';
import { saveWallet, deleteWallet } from '../api';
import type { Wallet } from '../api';

export function useWalletForm(loadData: () => Promise<void>) {
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
    color: '#2563eb',
  });

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
      color: '#2563eb',
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
        color: wallet.color,
      });
    } else {
      resetWalletForm();
    }
    setIsWalletModalOpen(true);
  };

  const handleSaveWallet = async (notify: (msg: string) => void) => {
    if (!walletForm.name.trim() || !walletForm.platform.trim()) return;
    await saveWallet({
      id: editingWalletId ?? editingWallet?.id,
      ...walletForm,
      balance: Number(walletForm.balance) || 0,
      opening_balance: Number(walletForm.opening_balance) || 0,
    });
    setIsWalletModalOpen(false);
    resetWalletForm();
    await loadData();
    notify(editingWalletId ? 'Billetera actualizada' : 'Billetera creada');
  };

  const handleDeactivateWallet = async (wallet: Wallet, notify: (msg: string, type?: 'success' | 'info') => void) => {
    if (!wallet.id) return;
    await saveWallet({ ...wallet, is_active: false });
    await loadData();
    notify('Billetera desactivada', 'info');
  };

  const handleDeleteWallet = async (wallet: Wallet, notify: (msg: string) => void) => {
    if (!wallet.id || !confirm(`¿Eliminar la billetera "${wallet.name}"?`)) return;
    await deleteWallet(wallet.id);
    await loadData();
    notify('Billetera eliminada');
  };

  return {
    isWalletModalOpen,
    setIsWalletModalOpen,
    editingWallet,
    editingWalletId,
    walletForm,
    setWalletForm,
    resetWalletForm,
    handleOpenWalletModal,
    handleSaveWallet,
    handleDeactivateWallet,
    handleDeleteWallet,
  };
}
