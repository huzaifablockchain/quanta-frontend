'use client';

import { useState } from 'react';
import { useAccount, useWriteContract, useWaitForTransactionReceipt, useReadContract } from 'wagmi';
import { CONTRACT_ADDRESSES, QTA_TOKEN_ABI, NFT_COLLECTION_ABI } from '@/lib/config/contracts';
import { parseQTA } from '@/lib/utils/format';
import toast from 'react-hot-toast';

export function useQTAApproval() {
  const { address } = useAccount();
  const [isApproving, setIsApproving] = useState(false);
  
  const { writeContract } = useWriteContract();

  const { data: allowance } = useReadContract({
    address: CONTRACT_ADDRESSES.QTA_TOKEN,
    abi: QTA_TOKEN_ABI,
    functionName: 'allowance',
    args: address ? [address, CONTRACT_ADDRESSES.MARKETPLACE] : undefined,
    query: {
      enabled: !!address,
      refetchInterval: 5000,
    },
  });

  function toBigIntSafe(v: unknown): bigint {
  if (typeof v === 'bigint') return v;
  if (typeof v === 'string') {
    if (/^\d+$/.test(v)) return BigInt(v);
    if (/^0x[0-9a-fA-F]+$/.test(v)) return BigInt(v);
  }
  if (typeof v === 'number' && Number.isFinite(v)) return BigInt(Math.trunc(v));
  return 0n;
}

  const approveQTA = async (amount: string) => {
    if (!address) {
      toast.error('Please connect your wallet');
      return false;
    }

    setIsApproving(true);
    
    try {
      const amountInWei = parseQTA(amount);
      
      await writeContract({
        address: CONTRACT_ADDRESSES.QTA_TOKEN,
        abi: QTA_TOKEN_ABI,
        functionName: 'approve',
        args: [CONTRACT_ADDRESSES.MARKETPLACE, amountInWei],
      });

      toast.success('QTA approval confirmed!');
      return true;
    } catch (error: any) {
      console.error('Approval error:', error);
      toast.error(error.message || 'Failed to approve QTA');
      return false;
    } finally {
      setIsApproving(false);
    }
  };

  const isApproved = (amount: string): boolean => {
    const allowanceValue = toBigIntSafe(allowance);
    const amountInWei = parseQTA(amount);
    return allowanceValue >= amountInWei;
  };

  return {
    allowance: allowance || 0n,
    approveQTA,
    isApproving,
    isApproved,
  };
}

export function useNFTApproval() {
  const { address } = useAccount();
  const [isApproving, setIsApproving] = useState(false);
  
  const { writeContract } = useWriteContract();

  const { data: isApprovedForAll } = useReadContract({
    address: CONTRACT_ADDRESSES.NFT_COLLECTION,
    abi: NFT_COLLECTION_ABI,
    functionName: 'isApprovedForAll',
    args: address ? [address, CONTRACT_ADDRESSES.MARKETPLACE] : undefined,
    query: {
      enabled: !!address,
      refetchInterval: 5000,
    },
  });

  const approveNFT = async () => {
    if (!address) {
      toast.error('Please connect your wallet');
      return false;
    }

    setIsApproving(true);
    
    try {
      await writeContract({
        address: CONTRACT_ADDRESSES.NFT_COLLECTION,
        abi: NFT_COLLECTION_ABI,
        functionName: 'setApprovalForAll',
        args: [CONTRACT_ADDRESSES.MARKETPLACE, true],
      });

      toast.success('NFT approval confirmed!');
      return true;
    } catch (error: any) {
      console.error('NFT approval error:', error);
      toast.error(error.message || 'Failed to approve NFT');
      return false;
    } finally {
      setIsApproving(false);
    }
  };

  return {
    isApprovedForAll: isApprovedForAll || false,
    approveNFT,
    isApproving,
  };
}