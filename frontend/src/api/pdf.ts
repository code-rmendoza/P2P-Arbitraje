import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { Wallet } from './wallets';
import type { Transaction } from './transactions';
import { formatNumber } from '../utils/currency';

interface PortfolioData {
  wallets: Wallet[];
  transactions: Transaction[];
  totalUsdt: number;
  profitUsdt: number;
  profitPct: number;
  tasaBcv: number;
}

export function exportPortfolioPDF(data: PortfolioData) {
  const doc = new jsPDF();
  const { wallets, transactions, totalUsdt, profitUsdt, profitPct, tasaBcv } = data;

  // Header
  doc.setFontSize(18);
  doc.text('P2P Arbitrage - Portafolio', 14, 22);
  doc.setFontSize(10);
  doc.setTextColor(100);
  doc.text(`Fecha: ${new Date().toLocaleDateString('es-VE')}`, 14, 30);
  doc.text(`Tasa BCV: ${formatNumber(tasaBcv, 4)} Bs/USDT`, 14, 36);

  // Summary
  doc.setFontSize(12);
  doc.setTextColor(0);
  doc.text('Resumen', 14, 48);
  doc.setFontSize(10);
  doc.text(`Total: $${formatNumber(totalUsdt)} USDT`, 14, 56);
  doc.text(`Profit: ${profitUsdt >= 0 ? '+' : ''}$${formatNumber(profitUsdt)} USDT (${profitPct >= 0 ? '+' : ''}${formatNumber(profitPct)}%)`, 14, 62);

  // Wallets table
  const activeWallets = wallets.filter(w => w.is_active);
  if (activeWallets.length > 0) {
    const walletData = activeWallets.map(w => [
      w.name,
      w.platform,
      w.currency,
      formatNumber(w.balance),
      formatNumber(w.opening_balance ?? w.balance),
    ]);

    autoTable(doc, {
      startY: 70,
      head: [['Billetera', 'Plataforma', 'Moneda', 'Saldo', 'Inicial']],
      body: walletData,
      theme: 'grid',
      headStyles: { fillColor: [37, 99, 235] },
    });
  }

  // Transactions table (last 20)
  const recentTxs = transactions
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 20);

  if (recentTxs.length > 0) {
    const startY = (doc as any).lastAutoTable?.finalY + 15 || 120;
    doc.setFontSize(12);
    doc.text('Ultimos 20 Movimientos', 14, startY);

    const txData = recentTxs.map(tx => [
      new Date(tx.date).toLocaleDateString('es-VE'),
      tx.type.replace('_P2P', ''),
      `${tx.wallet_from_name || 'Ext'} -> ${tx.wallet_to_name || 'Ext'}`,
      `-${formatNumber(tx.amount_out)}`,
      `+${formatNumber(tx.amount_in)}`,
      tx.rate.toFixed(4),
    ]);

    autoTable(doc, {
      startY: startY + 6,
      head: [['Fecha', 'Tipo', 'Ruta', 'Sale', 'Entra', 'Tasa']],
      body: txData,
      theme: 'grid',
      headStyles: { fillColor: [37, 99, 235] },
    });
  }

  doc.save('P2P_Portafolio.pdf');
}
