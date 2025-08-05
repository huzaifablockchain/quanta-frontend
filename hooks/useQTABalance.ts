'use client';

import { useReadContract, useAccount } from 'wagmi';
import { CONTRACT_ADDRESSES, QTA_TOKEN_ABI } from '@/lib/config/contracts';

export function useQTABalance() {
  const { address } = useAccount();

  const { data: balance, isLoading, refetch } = useReadContract({
    address: CONTRACT_ADDRESSES.QTA_TOKEN,
    abi: QTA_TOKEN_ABI,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    query: {
      enabled: !!address,
      refetchInterval: 5000,
    },
  });

  return {
    balance: balance || 0n,
    isLoading,
    refetch,
  };
}