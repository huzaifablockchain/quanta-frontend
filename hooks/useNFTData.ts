'use client';

import { useState, useEffect } from 'react';
import { useReadContract } from 'wagmi';
import { CONTRACT_ADDRESSES, NFT_COLLECTION_ABI } from '@/lib/config/contracts';
import { fetchMetadataFromIPFS } from '@/lib/utils/ipfs';

interface NFTMetadata {
  name: string;
  description: string;
  image: string;
  attributes?: Array<{
    trait_type: string;
    value: string | number;
  }>;
}

interface NFTData {
  tokenId: number;
  owner: string;
  tokenURI: string;
  metadata?: NFTMetadata;
}

export function useNFTData(tokenId: number) {
  const [metadata, setMetadata] = useState<NFTMetadata | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data: tokenURI } = useReadContract({
    address: CONTRACT_ADDRESSES.NFT_COLLECTION,
    abi: NFT_COLLECTION_ABI,
    functionName: 'tokenURI',
    args: [BigInt(tokenId)],
    query: {
      enabled: tokenId >= 0,
    },
  });

  const { data: owner } = useReadContract({
    address: CONTRACT_ADDRESSES.NFT_COLLECTION,
    abi: NFT_COLLECTION_ABI,
    functionName: 'ownerOf',
    args: [BigInt(tokenId)],
    query: {
      enabled: tokenId >= 0,
    },
  });

  useEffect(() => {
    async function fetchMetadata() {
      if (!tokenURI) return;
      
      setLoading(true);
      setError(null);
      
      try {
        const data = await fetchMetadataFromIPFS(tokenURI);
        setMetadata(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch metadata');
      } finally {
        setLoading(false);
      }
    }

    fetchMetadata();
  }, [tokenURI]);

  return {
    tokenId,
    owner: owner as string,
    tokenURI: tokenURI as string,
    metadata,
    loading,
    error,
  };
}