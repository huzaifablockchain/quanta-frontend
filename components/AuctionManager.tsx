'use client';

import { useState, useEffect } from 'react';
import { useAccount, useReadContract, useWriteContract, usePublicClient } from 'wagmi';
import { Clock, Gavel, Package, AlertCircle, CheckCircle } from 'lucide-react';
import { CONTRACT_ADDRESSES, MARKETPLACE_ABI, NFT_COLLECTION_ABI } from '@/lib/config/contracts';
import { formatQTA, formatAddress, formatTimeRemaining } from '@/lib/utils/format';
import { LoadingSpinner } from './ui/LoadingSpinner';
import toast from 'react-hot-toast';

interface AuctionInfo {
  tokenId: number;
  seller: string;
  startingBid: bigint;
  currentBid: bigint;
  highestBidder: string;
  endTime: number;
  isActive: boolean;
  canFinalize: boolean;
}

export function AuctionManager() {
  const { address, isConnected } = useAccount();
  const { writeContract } = useWriteContract();
  const publicClient = usePublicClient();
  
  const [auctions, setAuctions] = useState<AuctionInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [pendingReturns, setPendingReturns] = useState<bigint>(0n);

  // Get total minted to know which tokens exist
  const { data: totalMinted } = useReadContract({
    address: CONTRACT_ADDRESSES.NFT_COLLECTION,
    abi: NFT_COLLECTION_ABI,
    functionName: 'totalMinted',
  });

  const loadAuctions = async () => {
    if (!totalMinted || !publicClient) return;
    
    setLoading(true);
    const auctionList: AuctionInfo[] = [];
    
    try {
      for (let i = 0; i < Number(totalMinted); i++) {
        try {
                  const listing = await publicClient.readContract({
          address: CONTRACT_ADDRESSES.MARKETPLACE,
          abi: MARKETPLACE_ABI,
          functionName: 'getListing',
          args: [CONTRACT_ADDRESSES.NFT_COLLECTION, BigInt(i)],
        }) as any;
          
          if (listing && listing.active && listing.isAuction) {
            const timeRemaining = Math.max(0, Number(listing.auctionEndTime) - Math.floor(Date.now() / 1000));
            const isActive = timeRemaining > 0;
            const canFinalize = !isActive && listing.highestBidder !== '0x0000000000000000000000000000000000000000';
            
            auctionList.push({
              tokenId: i,
              seller: listing.seller,
              startingBid: listing.price,
              currentBid: listing.highestBid,
              highestBidder: listing.highestBidder,
              endTime: Number(listing.auctionEndTime),
              isActive,
              canFinalize,
            });
          }
        } catch (error) {
          // Skip tokens that don't exist or have errors
          continue;
        }
      }
      
      setAuctions(auctionList);
    } catch (error) {
      console.error('Error loading auctions:', error);
      toast.error('Failed to load auctions');
    } finally {
      setLoading(false);
    }
  };

  const checkPendingReturns = async () => {
    if (!address || !publicClient) return;

    try {
      const returns = await publicClient.readContract({
        address: CONTRACT_ADDRESSES.MARKETPLACE,
        abi: MARKETPLACE_ABI,
        functionName: 'pendingReturns',
        args: [address],
      }) as bigint;
      setPendingReturns(returns);
    } catch (error) {
      console.error('Error checking pending returns:', error);
    }
  };

  const handleFinalizeAuction = async (tokenId: number) => {
    if (!isConnected) return;

    try {
      await writeContract({
        address: CONTRACT_ADDRESSES.MARKETPLACE,
        abi: MARKETPLACE_ABI,
        functionName: 'finalizeAuction',
        args: [CONTRACT_ADDRESSES.NFT_COLLECTION, BigInt(tokenId)],
      });
      
      toast.success('Auction finalized successfully!');
      setTimeout(() => {
        loadAuctions();
        checkPendingReturns();
      }, 2000);
    } catch (error: any) {
      console.error('Auction finalization error:', error);
      toast.error(error.message || 'Failed to finalize auction');
    }
  };

  const handleWithdrawPendingReturns = async () => {
    if (!isConnected) return;

    try {
      await writeContract({
        address: CONTRACT_ADDRESSES.MARKETPLACE,
        abi: MARKETPLACE_ABI,
        functionName: 'withdrawPendingReturns',
        args: [],
      });
      
      toast.success('Pending returns withdrawn successfully!');
      setPendingReturns(0n);
    } catch (error: any) {
      console.error('Withdrawal error:', error);
      toast.error(error.message || 'Failed to withdraw pending returns');
    }
  };

  useEffect(() => {
    loadAuctions();
    checkPendingReturns();
  }, [totalMinted, publicClient, address]);

  if (!isConnected) {
    return (
      <div className="text-center py-12">
        <div className="max-w-md mx-auto bg-gradient-to-br from-slate-800 via-slate-900 to-gray-900 rounded-2xl p-8 shadow-2xl border border-slate-700/50 backdrop-blur-sm">
          <div className="w-16 h-16 bg-gradient-to-r from-purple-600 to-indigo-600 rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg shadow-purple-500/25">
            <Gavel className="w-8 h-8 text-white" />
          </div>
          <h2 className="text-xl font-semibold bg-gradient-to-r from-white to-gray-300 bg-clip-text text-transparent mb-2">Connect Your Wallet</h2>
          <p className="text-slate-400">
            Connect your wallet to manage auctions and withdraw pending returns
          </p>
        </div>
      </div>
    );
  }

  const activeAuctions = auctions.filter(auction => auction.isActive);
  const endedAuctions = auctions.filter(auction => !auction.isActive);

  return (
    <div>
      {/* Header */}
      <div className="mb-8 flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-white via-slate-200 to-gray-300 bg-clip-text text-transparent mb-2">Auction Manager</h1>
          <p className="text-slate-400">
            Manage auctions, finalize ended auctions, and withdraw pending returns
          </p>
        </div>
        <div className="flex gap-3">
          {pendingReturns > 0n && (
            <button
              onClick={handleWithdrawPendingReturns}
              className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-emerald-600 to-green-600 text-white rounded-xl hover:from-emerald-700 hover:to-green-700 transition-all duration-200 shadow-lg shadow-emerald-500/25 font-medium"
            >
              <Package className="w-4 h-4" />
              Withdraw {formatQTA(pendingReturns)}
            </button>
          )}
          <button
            onClick={() => {
              loadAuctions();
              checkPendingReturns();
            }}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-violet-600 to-indigo-600 text-white rounded-xl hover:from-violet-700 hover:to-indigo-700 disabled:opacity-50 transition-all duration-200 shadow-lg shadow-violet-500/25 font-medium"
          >
            {loading ? (
              <LoadingSpinner size="sm" />
            ) : (
              <Gavel className="w-4 h-4" />
            )}
            Refresh
          </button>
        </div>
      </div>

      {/* Pending Returns Alert */}
      {pendingReturns > 0n && (
        <div className="mb-6 p-4 bg-gradient-to-r from-amber-900/50 to-yellow-900/50 border border-amber-700/50 rounded-xl backdrop-blur-sm">
          <div className="flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-amber-400" />
            <div>
              <h3 className="font-medium text-amber-300">Pending Returns Available</h3>
              <p className="text-sm text-amber-200">
                You have {formatQTA(pendingReturns)} QTA in pending returns from outbid auctions.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <LoadingSpinner size="lg" />
        </div>
      ) : (
        <div className="space-y-8">
          {/* Active Auctions */}
          <div>
            <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
              <Clock className="w-5 h-5 text-blue-400" />
              Active Auctions ({activeAuctions.length})
            </h2>
            {activeAuctions.length === 0 ? (
              <div className="text-center py-8 bg-gradient-to-br from-slate-800/50 to-slate-900/50 rounded-xl border border-slate-700/50 backdrop-blur-sm">
                <p className="text-slate-400">No active auctions</p>
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {activeAuctions.map((auction) => (
                  <div key={auction.tokenId} className="bg-gradient-to-br from-slate-800 via-slate-900 to-gray-900 rounded-xl shadow-2xl p-6 border border-slate-700/50 backdrop-blur-sm">
                    <div className="flex justify-between items-start mb-4">
                      <h3 className="font-semibold text-white">Token #{auction.tokenId}</h3>
                      <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-gradient-to-r from-blue-500/20 to-cyan-500/20 text-blue-300 border border-blue-500/30">
                        <Clock className="w-3 h-3 mr-1" />
                        {formatTimeRemaining(auction.endTime - Math.floor(Date.now() / 1000))}
                      </span>
                    </div>
                    <div className="space-y-3 text-sm">
                      <div className="flex justify-between">
                        <span className="text-slate-400">Seller:</span>
                        <span className="font-medium text-slate-200">{formatAddress(auction.seller)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Starting Bid:</span>
                        <span className="font-medium text-slate-200">{formatQTA(auction.startingBid)} QTA</span>
                      </div>
                      {auction.currentBid > 0n && (
                        <>
                          <div className="flex justify-between">
                            <span className="text-slate-400">Current Bid:</span>
                            <span className="font-medium text-purple-400">{formatQTA(auction.currentBid)} QTA</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-400">Highest Bidder:</span>
                            <span className="font-medium text-purple-400">{formatAddress(auction.highestBidder)}</span>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Ended Auctions */}
          <div>
            <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-slate-400" />
              Ended Auctions ({endedAuctions.length})
            </h2>
            {endedAuctions.length === 0 ? (
              <div className="text-center py-8 bg-gradient-to-br from-slate-800/50 to-slate-900/50 rounded-xl border border-slate-700/50 backdrop-blur-sm">
                <p className="text-slate-400">No ended auctions</p>
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {endedAuctions.map((auction) => (
                  <div key={auction.tokenId} className="bg-gradient-to-br from-slate-800 via-slate-900 to-gray-900 rounded-xl shadow-2xl p-6 border border-slate-700/50 backdrop-blur-sm">
                    <div className="flex justify-between items-start mb-4">
                      <h3 className="font-semibold text-white">Token #{auction.tokenId}</h3>
                      {auction.canFinalize ? (
                        <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-gradient-to-r from-orange-500/20 to-amber-500/20 text-orange-300 border border-orange-500/30">
                          <Gavel className="w-3 h-3 mr-1" />
                          Ready to Finalize
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-gradient-to-r from-slate-500/20 to-gray-500/20 text-slate-300 border border-slate-500/30">
                          <CheckCircle className="w-3 h-3 mr-1" />
                          Finalized
                        </span>
                      )}
                    </div>
                    <div className="space-y-3 text-sm">
                      <div className="flex justify-between">
                        <span className="text-slate-400">Seller:</span>
                        <span className="font-medium text-slate-200">{formatAddress(auction.seller)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Starting Bid:</span>
                        <span className="font-medium text-slate-200">{formatQTA(auction.startingBid)} QTA</span>
                      </div>
                      {auction.currentBid > 0n ? (
                        <>
                          <div className="flex justify-between">
                            <span className="text-slate-400">Winning Bid:</span>
                            <span className="font-medium text-emerald-400">{formatQTA(auction.currentBid)} QTA</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-400">Winner:</span>
                            <span className="font-medium text-emerald-400">{formatAddress(auction.highestBidder)}</span>
                          </div>
                        </>
                      ) : (
                        <div className="text-center py-3 bg-gradient-to-r from-slate-700/50 to-slate-800/50 rounded-lg border border-slate-600/50">
                          <span className="text-slate-400 text-sm">No bids placed</span>
                        </div>
                      )}
                    </div>
                    {auction.canFinalize && (
                      <button
                        onClick={() => handleFinalizeAuction(auction.tokenId)}
                        className="w-full mt-4 bg-gradient-to-r from-orange-600 to-amber-600 text-white py-3 px-4 rounded-xl hover:from-orange-700 hover:to-amber-700 transition-all duration-200 font-medium shadow-lg shadow-orange-500/25"
                      >
                        Finalize Auction
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}