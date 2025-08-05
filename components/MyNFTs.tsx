'use client';

import { useState, useEffect } from 'react';
import { useAccount, useReadContract, useWriteContract, usePublicClient } from 'wagmi';
import { Package, Plus, Loader2 } from 'lucide-react';
import { NFTCard } from './NFTCard';
import { LoadingSpinner } from './ui/LoadingSpinner';
import { useNFTApproval } from '@/hooks/useApproval';
import { CONTRACT_ADDRESSES, NFT_COLLECTION_ABI, MARKETPLACE_ABI } from '@/lib/config/contracts';
import { parseQTA } from '@/lib/utils/format';
import toast from 'react-hot-toast';

interface OwnedNFT {
  tokenId: number;
  listing?: {
    seller: string;
    price: bigint;
    isAuction: boolean;
    auctionEndTime: number;
    highestBidder: string;
    highestBid: bigint;
    active: boolean;
  };
}

export function MyNFTs() {
  const { address, isConnected } = useAccount();
  const { approveNFT, isApprovedForAll, isApproving } = useNFTApproval();
  const { writeContract } = useWriteContract();
  const publicClient = usePublicClient();
  
  const [ownedNFTs, setOwnedNFTs] = useState<OwnedNFT[]>([]);
  const [loading, setLoading] = useState(true);
  const [showListModal, setShowListModal] = useState(false);
  const [selectedTokenId, setSelectedTokenId] = useState<number | null>(null);
  const [listingForm, setListingForm] = useState({
    price: '',
    isAuction: false,
    duration: '24', // hours
  });

  const refreshNFTs = () => {
    setLoading(true);
    loadOwnedNFTs();
  };

  // Get user's NFT balance
  const { data: balance } = useReadContract({
    address: CONTRACT_ADDRESSES.NFT_COLLECTION,
    abi: NFT_COLLECTION_ABI,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    query: {
      enabled: !!address,
    },
  });

  // Load user's NFTs
  const loadOwnedNFTs = async () => {
    if (!address || !balance || !publicClient) return;
    
    setLoading(true);
    const nfts: OwnedNFT[] = [];
    
    try {
      // Get total minted to know the range to check
      const totalMinted = await publicClient.readContract({
        address: CONTRACT_ADDRESSES.NFT_COLLECTION,
        abi: NFT_COLLECTION_ABI,
        functionName: 'totalMinted',
        args: [],
      });
      
      console.log('Loading NFTs for address:', address, 'Balance:', balance, 'Total Minted:', totalMinted);
      
      // Check all tokens up to totalMinted to see which ones the user owns
      for (let i = 0; i < Number(totalMinted); i++) {
        try {
                  const owner = await publicClient.readContract({
          address: CONTRACT_ADDRESSES.NFT_COLLECTION,
          abi: NFT_COLLECTION_ABI,
          functionName: 'ownerOf',
          args: [BigInt(i)],
        }) as string;
          
          // If user owns this token
          if (owner.toLowerCase() === address.toLowerCase()) {
            console.log('Found owned NFT:', i);
            
            // Check if token is listed
            let listing;
            try {
                      const listingData = await publicClient.readContract({
          address: CONTRACT_ADDRESSES.MARKETPLACE,
          abi: MARKETPLACE_ABI,
          functionName: 'getListing',
          args: [CONTRACT_ADDRESSES.MARKETPLACE, BigInt(i)],
        }) as any;
        
        if (listingData && listingData.active) {
                listing = {
                  seller: listingData.seller,
                  price: listingData.price,
                  isAuction: listingData.isAuction,
                  auctionEndTime: Number(listingData.auctionEndTime),
                  highestBidder: listingData.highestBidder,
                  highestBid: listingData.highestBid,
                  active: listingData.active,
                };
              }
            } catch (error) {
              // Token not listed, that's fine
              console.log(`Token ${i} not listed:`, error);
            }

            nfts.push({
              tokenId: i,
              listing,
            });
          }
        } catch (error) {
          console.warn(`Failed to load token ${i}:`, error);
        }
      }
      
      setOwnedNFTs(nfts);
    } catch (error) {
      console.error('Error loading owned NFTs:', error);
      toast.error('Failed to load your NFTs');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadOwnedNFTs();
  }, [address, balance, publicClient]);

  const handleListNFT = async () => {
    console.log('handleListNFT called with:', {
      address,
      selectedTokenId,
      price: listingForm.price,
      isAuction: listingForm.isAuction,
      duration: listingForm.duration,
      isApprovedForAll
    });

    // Validate form data
    if (!selectedTokenId || !address || !listingForm.price) {
      console.log('Missing required data:', { selectedTokenId, address: !!address, price: !!listingForm.price });
      toast.error('Please fill in all required fields');
      return;
    }

    const price = parseFloat(listingForm.price);
    if (isNaN(price) || price <= 0) {
      toast.error('Please enter a valid price');
      return;
    }

    if (listingForm.isAuction) {
      const duration = parseInt(listingForm.duration);
      if (isNaN(duration) || duration <= 0) {
        toast.error('Please enter a valid auction duration');
        return;
      }
    }

    // Check NFT approval
    if (!isApprovedForAll) {
      console.log('NFT not approved, requesting approval...');
      toast.loading('Approving NFT for marketplace...');
      const approved = await approveNFT();
      if (!approved) {
        console.log('NFT approval failed');
        toast.dismiss();
        toast.error('NFT approval failed');
        return;
      }
      console.log('NFT approval successful');
      toast.dismiss();
    }

    try {
      toast.loading('Creating listing...');
      
      const priceInWei = parseQTA(listingForm.price);
      const durationInSeconds = listingForm.isAuction 
        ? parseInt(listingForm.duration) * 3600 // hours to seconds
        : 0;

      console.log('Calling listNFT with args:', [
        CONTRACT_ADDRESSES.NFT_COLLECTION,
        BigInt(selectedTokenId),
        priceInWei,
        listingForm.isAuction,
        BigInt(durationInSeconds),
      ]);

      await writeContract({
        address: CONTRACT_ADDRESSES.MARKETPLACE,
        abi: MARKETPLACE_ABI,
        functionName: 'listNFT',
        args: [
          CONTRACT_ADDRESSES.NFT_COLLECTION,
          BigInt(selectedTokenId),
          priceInWei,
          listingForm.isAuction,
          BigInt(durationInSeconds),
        ],
      });

      toast.dismiss();
      toast.success(`NFT ${listingForm.isAuction ? 'auction' : 'listing'} created!`);
      setShowListModal(false);
      setListingForm({ price: '', isAuction: false, duration: '24' });
      setSelectedTokenId(null);
      
      // Refresh owned NFTs
      setTimeout(() => {
        loadOwnedNFTs();
      }, 2000);
    } catch (error: any) {
      toast.dismiss();
      console.error('Listing error:', error);
      toast.error(error.message || 'Failed to list NFT');
    }
  };

  const handleDelistNFT = async (tokenId: number) => {
    if (!address) return;

    try {
      await writeContract({
        address: CONTRACT_ADDRESSES.MARKETPLACE,
        abi: MARKETPLACE_ABI,
        functionName: 'delistNFT',
        args: [CONTRACT_ADDRESSES.NFT_COLLECTION, BigInt(tokenId)],
      });

      toast.success('NFT delisted successfully!');
      // Refresh owned NFTs
      setTimeout(() => {
        loadOwnedNFTs();
      }, 2000);
    } catch (error: any) {
      console.error('Delisting error:', error);
      toast.error(error.message || 'Failed to delist NFT');
    }
  };

  if (!isConnected) {
    return (
      <div className="text-center py-12">
        <div className="max-w-md mx-auto bg-white rounded-xl p-8 shadow-lg">
          <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Package className="w-8 h-8 text-blue-600" />
          </div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Connect Your Wallet</h2>
          <p className="text-gray-600">
            Connect your wallet to view and manage your NFT collection
          </p>
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-8 flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">My NFTs</h1>
          <p className="text-gray-600">
            Manage your NFT collection and marketplace listings
          </p>
        </div>
        <button
          onClick={refreshNFTs}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Package className="w-4 h-4" />
          )}
          Refresh
        </button>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <LoadingSpinner size="lg" />
        </div>
      ) : ownedNFTs.length === 0 ? (
        <div className="text-center py-12">
          <div className="max-w-md mx-auto bg-white rounded-xl p-8 shadow-lg">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Package className="w-8 h-8 text-gray-400" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No NFTs Found</h3>
            <p className="text-gray-600 mb-4">
              You don't have any NFTs yet. Start by minting your first NFT!
            </p>
            <button
              onClick={() => window.location.href = '/mint'}
              className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Plus className="w-4 h-4 mr-2" />
              Mint Your First NFT
            </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {ownedNFTs.map(({ tokenId, listing }) => (
            <NFTCard
              key={tokenId}
              tokenId={tokenId}
              listing={listing}
              onList={() => {
                setSelectedTokenId(tokenId);
                setShowListModal(true);
              }}
              onDelist={() => handleDelistNFT(tokenId)}
              isOwner={true}
              showActions={true}
            />
          ))}
        </div>
      )}

      {/* List NFT Modal */}
      {showListModal && selectedTokenId !== null && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">List NFT</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {listingForm.isAuction ? 'Starting Bid' : 'Price'} (QTA)
                </label>
                <input
                  type="number"
                  value={listingForm.price}
                  onChange={(e) => setListingForm(prev => ({ ...prev, price: e.target.value }))}
                  step="0.01"
                  min="0"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Enter price"
                />
              </div>

              <div>
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={listingForm.isAuction}
                    onChange={(e) => setListingForm(prev => ({ ...prev, isAuction: e.target.checked }))}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="ml-2 text-sm text-gray-700">Create as auction</span>
                </label>
              </div>

              {listingForm.isAuction && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Auction Duration (hours)
                  </label>
                  <select
                    value={listingForm.duration}
                    onChange={(e) => setListingForm(prev => ({ ...prev, duration: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="1">1 hour</option>
                    <option value="6">6 hours</option>
                    <option value="24">24 hours</option>
                    <option value="72">3 days</option>
                    <option value="168">7 days</option>
                  </select>
                </div>
              )}

              {!isApprovedForAll && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                  <p className="text-sm text-yellow-800">
                    You need to approve the marketplace to manage your NFTs first.
                  </p>
                </div>
              )}
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => {
                  setShowListModal(false);
                  setListingForm({ price: '', isAuction: false, duration: '24' });
                  setSelectedTokenId(null);
                }}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              
              {!isApprovedForAll ? (
                <button
                  onClick={approveNFT}
                  disabled={isApproving}
                  className="flex-1 px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
                >
                  {isApproving ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Approving...
                    </>
                  ) : (
                    'Approve NFTs'
                  )}
                </button>
              ) : (
                <button
                  onClick={handleListNFT}
                  disabled={!listingForm.price || parseFloat(listingForm.price) <= 0}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  List NFT
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}