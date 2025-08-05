import { formatUnits, parseUnits } from 'viem';

export function formatQTA(amount: bigint): string {
  return formatUnits(amount, 6);
}

export function parseQTA(amount: string): bigint {
  return parseUnits(amount, 6);
}

export function formatPrice(price: string): string {
  const num = parseFloat(price);
  if (num >= 1000000) {
    return `${(num / 1000000).toFixed(1)}M`;
  } else if (num >= 1000) {
    return `${(num / 1000).toFixed(1)}K`;
  }
  return num.toFixed(2);
}

export function formatAddress(address: string): string {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export function formatTimeRemaining(seconds: number): string {
  if (seconds <= 0) return 'Ended';
  
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

export function isValidPrice(price: string): boolean {
  const num = parseFloat(price);
  return !isNaN(num) && num > 0;
}

// Fee calculation constants (matching the smart contract)
export const PLATFORM_FEE = 500; // 5% = 500 / 10000
export const CREATOR_ROYALTY = 500; // 5% = 500 / 10000

export function calculateFees(salePrice: bigint) {
  const platformFee = (salePrice * BigInt(PLATFORM_FEE)) / 10000n;
  const creatorRoyalty = (salePrice * BigInt(CREATOR_ROYALTY)) / 10000n;
  const sellerAmount = salePrice - platformFee - creatorRoyalty;
  
  return {
    platformFee,
    creatorRoyalty,
    sellerAmount,
    totalFees: platformFee + creatorRoyalty
  };
}