export function amountToUsdt(amount: number, currency?: string | null, tasaBcv: number = 0): number {
  if (currency === 'USDT' || currency === 'USD') return amount;
  if (currency === 'VES') return tasaBcv > 0 ? amount / tasaBcv : 0;
  return 0;
}
