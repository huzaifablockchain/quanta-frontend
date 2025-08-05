'use client';

import { useAccount, useReadContract } from 'wagmi';
import { CONTRACT_ADDRESSES, QTA_TOKEN_ABI } from '@/lib/config/contracts';

export function DebugBalance() {
  const { address, isConnected } = useAccount();

  const { data: balance, isLoading, error } = useReadContract({
    address: CONTRACT_ADDRESSES.QTA_TOKEN,
    abi: QTA_TOKEN_ABI,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    query: {
      enabled: !!address,
    },
  });

  const { data: decimals } = useReadContract({
    address: CONTRACT_ADDRESSES.QTA_TOKEN,
    abi: QTA_TOKEN_ABI,
    functionName: 'decimals',
  });

  const { data: symbol } = useReadContract({
    address: CONTRACT_ADDRESSES.QTA_TOKEN,
    abi: QTA_TOKEN_ABI,
    functionName: 'symbol',
  });

  if (!isConnected) {
    return <div className="p-4 bg-yellow-100 rounded">Wallet not connected</div>;
  }

  return (
    <div className="p-4 bg-gray-100 rounded space-y-2">
      <h3 className="font-bold">Debug Information:</h3>
      <div>Wallet Address: {address}</div>
      <div>Contract Address: {CONTRACT_ADDRESSES.QTA_TOKEN}</div>
      <div>Token Symbol: {symbol?.toString()}</div>
      <div>Decimals: {decimals?.toString()}</div>
      <div>Raw Balance: {balance?.toString()}</div>
      <div>Loading: {isLoading ? 'Yes' : 'No'}</div>
      {error && <div className="text-red-600">Error: {error.message}</div>}
    </div>
  );
} 