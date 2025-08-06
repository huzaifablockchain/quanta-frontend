'use client';

import { useState, useEffect } from 'react';
import { useAccount, useReadContract, useWriteContract, usePublicClient } from 'wagmi';
import { Upload, Search, Filter, SortAsc, Grid, List, Package, Loader2, Eye, Clock, Users, TrendingUp, Zap, Heart, Star, Activity, ArrowRight, Wallet, RefreshCw } from 'lucide-react';
import Link from 'next/link';
import { NFTCard } from './NFTCard';
import { LoadingSpinner } from './ui/LoadingSpinner';
import { CONTRACT_ADDRESSES, MARKETPLACE_ABI, NFT_COLLECTION_ABI } from '@/lib/config/contracts';
import { useQTAApproval } from '@/hooks/useApproval';
import { formatQTA, parseQTA } from '@/lib/utils/format';
import toast from 'react-hot-toast';

interface ListingData {
  seller: string;
  price: bigint;
  isAuction: boolean;
  auctionEndTime: number;
  highestBidder: string;
  highestBid: bigint;
  active: boolean;
}

interface NFTData {
  tokenId: number;
  listing?: ListingData;
  owner: string;
  isListed: boolean;
}

const categories = [
  { name: 'All', icon: TrendingUp, active: true, count: 2345 },
  { name: 'Art', icon: Eye, active: false, count: 856 },
  { name: 'Gaming', icon: Package, active: false, count: 423 },
  { name: 'Music', icon: Clock, active: false, count: 189 },
  { name: 'Sports', icon: Users, active: false, count: 267 },
  { name: 'Photography', icon: Star, active: false, count: 145 },
];

// Featured NFTs will be populated from actual marketplace data
const featuredNFTs: any[] = [];

export function MarketplacePage() {
  const { address, isConnected } = useAccount();
  const { approveQTA, isApproved } = useQTAApproval();
  const { writeContract } = useWriteContract();
  const publicClient = usePublicClient();

  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<'price' | 'newest' | 'oldest'>('newest');
  const [filterBy, setFilterBy] = useState<'all' | 'auction' | 'sale'>('all');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [nfts, setNfts] = useState<Array<NFTData>>([]);
  const [loading, setLoading] = useState(true);
  const [bidAmount, setBidAmount] = useState('');
  const [selectedTokenId, setSelectedTokenId] = useState<number | null>(null);
  const [showBidModal, setShowBidModal] = useState(false);
  const [pendingReturns, setPendingReturns] = useState<bigint>(0n);

  // Get total minted to know which tokens exist
  const { data: totalMinted } = useReadContract({
    address: CONTRACT_ADDRESSES.NFT_COLLECTION,
    abi: NFT_COLLECTION_ABI,
    functionName: 'totalMinted',
  });

  // Load all NFTs
  const loadNFTs = async () => {
    if (!totalMinted || !publicClient) return;

    setLoading(true);
    const allNFTs: Array<NFTData> = [];

    try {
      console.log('Loading all NFTs, total minted:', totalMinted);

      // Check each token
      for (let i = 0; i < Number(totalMinted); i++) {
        try {
          // Get NFT owner
          const owner = await publicClient.readContract({
            address: CONTRACT_ADDRESSES.NFT_COLLECTION,
            abi: NFT_COLLECTION_ABI,
            functionName: 'ownerOf',
            args: [BigInt(i)],
          }) as string;

          // Check if NFT is listed
          const listing = await publicClient.readContract({
            address: CONTRACT_ADDRESSES.MARKETPLACE,
            abi: MARKETPLACE_ABI,
            functionName: 'getListing',
            args: [CONTRACT_ADDRESSES.NFT_COLLECTION, BigInt(i)],
          }) as any;

          const isListed = listing && listing.active;

          allNFTs.push({
            tokenId: i,
            owner,
            isListed,
            listing: isListed ? {
              seller: listing.seller,
              price: listing.price,
              isAuction: listing.isAuction,
              auctionEndTime: Number(listing.auctionEndTime),
              highestBidder: listing.highestBidder,
              highestBid: listing.highestBid,
              active: listing.active,
            } : undefined,
          });
        } catch (error) {
          console.log(`Error loading NFT ${i}:`, error);
          continue;
        }
      }

      console.log('Total NFTs found:', allNFTs.length);
      setNfts(allNFTs);
    } catch (error) {
      console.error('Error loading NFTs:', error);
      toast.error('Failed to load NFTs');
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

  useEffect(() => {
    loadNFTs();
    checkPendingReturns();
  }, [totalMinted, publicClient, address]);

  const handleBuyNow = async (tokenId: number, price: bigint) => {
    if (!isConnected || !address) {
      toast.error('Please connect your wallet');
      return;
    }

    const priceFormatted = formatQTA(price);

    if (!isApproved(priceFormatted)) {
      const approved = await approveQTA(priceFormatted);
      if (!approved) return;
    }

    try {
      await writeContract({
        address: CONTRACT_ADDRESSES.MARKETPLACE,
        abi: MARKETPLACE_ABI,
        functionName: 'buyNow',
        args: [CONTRACT_ADDRESSES.NFT_COLLECTION, BigInt(tokenId)],
      });

      toast.success('Purchase successful!');
      // Refresh NFTs after a delay
      setTimeout(() => {
        loadNFTs();
      }, 2000);
    } catch (error: any) {
      console.error('Purchase error:', error);
      toast.error(error.message || 'Purchase failed');
    }
  };

  const handlePlaceBid = async () => {
    console.log('handlePlaceBid called with:', { selectedTokenId, bidAmount, isConnected });

    if (!selectedTokenId || !bidAmount || !isConnected) {
      toast.error('Please fill in all required fields');
      return;
    }

    const bidAmountNum = parseFloat(bidAmount);
    if (isNaN(bidAmountNum) || bidAmountNum <= 0) {
      toast.error('Please enter a valid bid amount');
      return;
    }

    // Find the current listing to check minimum bid requirements
    const currentNFT = nfts.find(nft => nft.tokenId === selectedTokenId);
    const currentListing = currentNFT?.listing;
    if (!currentNFT || !currentListing) {
      toast.error('Listing not found');
      return;
    }

    const bidAmountWei = parseQTA(bidAmount);

    // Check if bid meets minimum requirements
    if (currentListing.highestBid > 0n) {
      // Must be at least 2% higher than current bid
      const minBidIncrement = (currentListing.highestBid * 200n) / 10000n;
      const minBid = currentListing.highestBid + minBidIncrement;

      if (bidAmountWei < minBid) {
        toast.error(`Bid must be at least ${formatQTA(minBid)} QTA (2% higher than current bid)`);
        return;
      }
    } else {
      // First bid must meet starting price
      if (bidAmountWei < currentListing.price) {
        toast.error(`Bid must be at least ${formatQTA(currentListing.price)} QTA`);
        return;
      }
    }

    if (!isApproved(bidAmount)) {
      toast.loading('Approving QTA tokens...');
      const approved = await approveQTA(bidAmount);
      if (!approved) {
        toast.dismiss();
        toast.error('QTA approval failed');
        return;
      }
      toast.dismiss();
    }

    try {
      toast.loading('Placing bid...');

      await writeContract({
        address: CONTRACT_ADDRESSES.MARKETPLACE,
        abi: MARKETPLACE_ABI,
        functionName: 'bid',
        args: [
          CONTRACT_ADDRESSES.NFT_COLLECTION,
          BigInt(selectedTokenId),
          bidAmountWei,
        ],
      });

      toast.dismiss();
      toast.success('Bid placed successfully!');
      setShowBidModal(false);
      setBidAmount('');
      setSelectedTokenId(null);
      // Refresh NFTs after a delay
      setTimeout(() => {
        loadNFTs();
      }, 2000);
    } catch (error: any) {
      toast.dismiss();
      console.error('Bid error:', error);
      toast.error(error.message || 'Bid failed');
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
      // Refresh NFTs after a delay
      setTimeout(() => {
        loadNFTs();
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

  const filteredAndSortedNFTs = nfts
    .filter((nft) => {
      if (!nft.isListed) return true; // Show all NFTs, listed or not
      if (filterBy === 'auction') return nft.listing?.isAuction;
      if (filterBy === 'sale') return nft.listing && !nft.listing.isAuction;
      return true;
    })
    .sort((a, b) => {
      switch (sortBy) {
        case 'price':
          const priceA = a.listing?.price || 0n;
          const priceB = b.listing?.price || 0n;
          return Number(priceA - priceB);
        case 'oldest':
          return a.tokenId - b.tokenId;
        case 'newest':
        default:
          return b.tokenId - a.tokenId;
      }
    });

  if (!isConnected) {
    return (
      <div className="max-w-md mx-auto text-center py-12">
        <div className="bg-gradient-to-br from-slate-800 via-slate-900 to-gray-900 rounded-2xl p-8 shadow-2xl border border-slate-700/50 backdrop-blur-sm">
          <div className="w-16 h-16 bg-gradient-to-r from-violet-600 to-indigo-600 rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg shadow-violet-500/25">
            <Upload className="w-8 h-8 text-white" />
          </div>
          <h2 className="text-xl font-semibold bg-gradient-to-r from-white to-gray-300 bg-clip-text text-transparent mb-2">Connect Your Wallet</h2>
          <p className="text-slate-400">
            Please connect your wallet to start bidding NFTs
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-12">
      {/* Enhanced Hero Section */}
      <div className="relative bg-gradient-to-br from-slate-800 via-slate-900 to-gray-900 rounded-3xl overflow-hidden border border-slate-700/50">
        <div className="absolute inset-0 bg-black/20"></div>
        <div className="relative z-10 p-8 md:p-16">
          <div className="max-w-6xl mx-auto">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
              <div className="text-white">
                <div className="inline-flex items-center bg-white/10 backdrop-blur-sm rounded-full px-4 py-2 mb-6 border border-white/20">
                  <Activity className="w-4 h-4 mr-2 text-green-400" />
                  <span className="text-sm font-medium">Live Marketplace</span>
                  <div className="w-2 h-2 bg-green-400 rounded-full ml-2 animate-pulse"></div>
                </div>

                <h1 className="text-5xl md:text-7xl font-bold mb-6 leading-tight">
                  Discover & Collect
                  <span className="bg-gradient-to-r from-pink-400 to-purple-400 bg-clip-text text-transparent"> Rare </span>
                  NFTs
                </h1>

                <p className="text-xl text-white/80 mb-8 max-w-xl">
                  The premier destination for discovering, collecting, and trading extraordinary digital assets on the blockchain.
                </p>

                <div className="flex flex-col sm:flex-row gap-4 mb-8">
                  <button className="inline-flex items-center justify-center px-8 py-4 bg-white text-gray-900 rounded-2xl hover:bg-gray-100 transition-all duration-300 font-semibold text-lg transform hover:scale-105">
                    <Search className="mr-2 w-5 h-5" />
                    Explore Collection
                  </button>
                  <Link href="/mint" className="inline-flex items-center justify-center px-8 py-4 border-2 border-white text-white rounded-2xl hover:bg-white hover:text-gray-900 transition-all duration-300 font-semibold text-lg">
                    <Zap className="mr-2 w-5 h-5" />
                    Create NFT
                  </Link>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-3 gap-6">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-white">{nfts.length}</div>
                    <div className="text-white/60 text-sm">Total NFTs</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-white">{nfts.filter(nft => nft.isListed && nft.listing?.isAuction).length}</div>
                    <div className="text-white/60 text-sm">Live Auctions</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-white">{nfts.filter(nft => nft.isListed && nft.listing && !nft.listing.isAuction).length}</div>
                    <div className="text-white/60 text-sm">Buy Now</div>
                  </div>
                </div>
              </div>

              <div className="relative">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-4">
                    <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-4 border border-white/20">
                      <img
                        src="https://i2.seadn.io/ethereum/0x8a90cab2b38dba80c64b7734e58ee1db38b8992e/7c8f36724756afe46fdf406fdae3d433.png?w=1000000000"
                        alt="NFT"
                        className="w-full h-full object-cover rounded-xl mb-3"
                      />
                      <p className="text-white font-medium text-sm">Doodle in space</p>
                      <p className="text-white/60 text-xs">5 QTA</p>
                    </div>
                    <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-4 border border-white/20 transform translate-x-8">
                      <img
                        src="https://i2.seadn.io/ethereum/0xb47e3cd837ddf8e4c57f05d70ab865de6e193bbb/67fc91ff36238e9d2dd44825ee48d3/5067fc91ff36238e9d2dd44825ee48d3.png?w=1000"
                        alt="NFT"
                        className="w-full h-full object-cover rounded-xl mb-3"
                      />
                      <p className="text-white font-medium text-sm">Crypto Punk</p>
                      <p className="text-white/60 text-xs">50 QTA</p>
                    </div>
                  </div>
                  <div className="space-y-4 pt-8">
                    <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-4 border border-white/20 transform -translate-x-4">
                      <img
                        src="https://i2.seadn.io/base/0x6c7726dcbee2ba4aa240f880ac28dd3230b6cb76/0ec270fd216193ce208d90d3854686/5f0ec270fd216193ce208d90d3854686.png?w=1000"
                        alt="NFT"
                        className="w-full h-full object-cover rounded-xl mb-3"
                      />
                      <p className="text-white font-medium text-sm">Azuki</p>
                      <p className="text-white/60 text-xs">3.2 QTA</p>
                    </div>
                    <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-4 border border-white/20">
                      <img
                        src="https://i2.seadn.io/base/0x7e72abdf47bd21bf0ed6ea8cb8dad60579f3fb50/616debe1ec357bb98e96dd2024b57d/80616debe1ec357bb98e96dd2024b57d.png?w=1000"
                        alt="NFT"
                        className="w-full object-cover rounded-xl mb-3"
                      />
                      <p className="text-white font-medium text-sm">Bored Ape</p>
                      <p className="text-white/60 text-xs">500 QTA</p>
                    </div>
                  </div>
                </div>
              </div>

            </div>
          </div>
        </div>
      </div>

      {/* Enhanced Categories
        <div>
          <div className="flex items-center justify-between mb-8">
            <div>
              <h2 className="text-3xl font-bold text-white mb-2">Browse Categories</h2>
              <p className="text-gray-400">Discover NFTs across different categories</p>
            </div>
            <Link href="#" className="text-blue-400 hover:text-blue-300 font-medium flex items-center group">
              View All 
              <ArrowRight className="ml-1 w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </Link>
          </div>
        
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {categories.map((category) => (
            <button
              key={category.name}
              className={`group p-6 rounded-2xl transition-all duration-300 border ${
                category.active
                  ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white border-transparent shadow-lg'
                  : 'bg-gray-800/50 text-gray-300 hover:bg-gray-700 hover:text-white border-gray-700 hover:border-gray-600 hover:shadow-lg'
              }`}
            >
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center mx-auto mb-3 ${
                category.active ? 'bg-white/20' : 'bg-gray-700 group-hover:bg-gray-600'
              }`}>
                <category.icon className="w-6 h-6" />
              </div>
              <h3 className="font-medium mb-1">{category.name}</h3>
              <p className="text-xs opacity-60">{category.count.toLocaleString()} items</p>
            </button>
          ))}
        </div>
      </div> */}

      {/* Actual Marketplace Content */}
      {filteredAndSortedNFTs.length > 0 && (
        <>
          {/* Enhanced Header */}
          <div className="bg-gray-800/50 backdrop-blur-sm rounded-2xl p-8 border border-gray-700">
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
              <div className="flex-1">
                <h1 className="text-3xl font-bold text-white mb-2 flex items-center">
                  <TrendingUp className="w-8 h-8 mr-3 text-blue-400" />
                  NFT Marketplace
                </h1>
                <p className="text-gray-400">
                  {filteredAndSortedNFTs.length} items • {nfts.filter(nft => nft.isListed && nft.listing?.isAuction).length} live auctions
                </p>
              </div>

              <div className="flex flex-wrap gap-3">
                {pendingReturns > 0n && (
                  <button
                    onClick={handleWithdrawPendingReturns}
                    className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-xl hover:from-green-700 hover:to-emerald-700 transition-all duration-300 transform hover:scale-105 shadow-lg"
                  >
                    <Package className="w-5 h-5" />
                    Withdraw {formatQTA(pendingReturns)} QTA
                  </button>
                )}
                <button
                  onClick={loadNFTs}
                  disabled={loading}
                  className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-50 transition-all duration-300 transform hover:scale-105 shadow-lg"
                >
                  {loading ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <RefreshCw className="w-5 h-5" />
                  )}
                  {loading ? 'Loading...' : 'Refresh'}
                </button>
              </div>
            </div>
          </div>

          {/* Enhanced Filters and Search */}
          <div className="bg-gray-800/50 backdrop-blur-sm rounded-2xl shadow-xl p-6 mb-8 border border-gray-700">
            <div className="flex flex-col lg:flex-row gap-6">
              {/* Enhanced Search */}
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                  <input
                    type="text"
                    placeholder="Search by name, creator, or description..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-12 pr-4 py-4 bg-gray-700/50 border border-gray-600 rounded-xl text-white placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-300"
                  />
                </div>
              </div>

              {/* Enhanced Filters */}
              <div className="flex flex-wrap items-center gap-4">
                <div className="flex items-center gap-2">
                  <Filter className="w-4 h-4 text-gray-400" />
                  <select
                    value={filterBy}
                    onChange={(e) => setFilterBy(e.target.value as any)}
                    className="px-4 py-3 bg-gray-700/50 border border-gray-600 rounded-xl text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-300"
                  >
                    <option value="all">All NFTs ({nfts.length})</option>
                    <option value="sale">Fixed Price ({nfts.filter(nft => nft.isListed && nft.listing && !nft.listing.isAuction).length})</option>
                    <option value="auction">Live Auctions ({nfts.filter(nft => nft.isListed && nft.listing?.isAuction).length})</option>
                  </select>
                </div>

                <div className="flex items-center gap-2">
                  <SortAsc className="w-4 h-4 text-gray-400" />
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as any)}
                    className="px-4 py-3 bg-gray-700/50 border border-gray-600 rounded-xl text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-300"
                  >
                    <option value="newest">Newest First</option>
                    <option value="oldest">Oldest First</option>
                    <option value="price">Price: Low to High</option>
                  </select>
                </div>

                <div className="flex rounded-xl border border-gray-600 overflow-hidden bg-gray-700/50">
                  <button
                    onClick={() => setViewMode('grid')}
                    className={`p-3 transition-all duration-300 ${viewMode === 'grid' ? 'bg-blue-600 text-white' : 'text-gray-300 hover:text-white hover:bg-gray-600'}`}
                  >
                    <Grid className="w-5 h-5" />
                  </button>
                  <button
                    onClick={() => setViewMode('list')}
                    className={`p-3 transition-all duration-300 ${viewMode === 'list' ? 'bg-blue-600 text-white' : 'text-gray-300 hover:text-white hover:bg-gray-600'}`}
                  >
                    <List className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Enhanced Content */}
          {loading ? (
            <div className="flex flex-col items-center justify-center py-16">
              <div className="relative">
                <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                <div className="absolute inset-0 w-16 h-16 border-4 border-purple-600 border-b-transparent rounded-full animate-spin animation-delay-150"></div>
              </div>
              <p className="text-white text-lg font-medium mt-6">Loading marketplace...</p>
              <p className="text-gray-400 text-sm">Fetching the latest NFT listings</p>
            </div>
          ) : filteredAndSortedNFTs.length === 0 ? (
            <div className="text-center py-16">
              <div className="max-w-md mx-auto">
                <div className="w-24 h-24 bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-6">
                  <Package className="w-12 h-12 text-gray-400" />
                </div>
                <h3 className="text-2xl font-bold text-white mb-4">No NFTs Found</h3>
                <p className="text-gray-400 mb-8">
                  {searchTerm ? `No results found for "${searchTerm}"` : 'No active listings match your current filters'}
                </p>
                <div className="flex flex-col sm:flex-row gap-4 justify-center">
                  <button
                    onClick={() => {
                      setSearchTerm('');
                      setFilterBy('all');
                      setSortBy('newest');
                    }}
                    className="px-6 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-all duration-300"
                  >
                    Clear Filters
                  </button>
                  <Link
                    href="/mint"
                    className="px-6 py-3 border border-gray-600 text-gray-300 rounded-xl hover:bg-gray-700 hover:text-white transition-all duration-300"
                  >
                    Create First NFT
                  </Link>
                </div>
              </div>
            </div>
          ) : (
            <div className={`grid gap-6 ${viewMode === 'grid'
              ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4'
              : 'grid-cols-1'
              }`}>
              {filteredAndSortedNFTs.map((nft) => (
                <div key={nft.tokenId} className="group">
                  <NFTCard
                    tokenId={nft.tokenId}
                    listing={nft.listing}
                    onBuy={() => nft.listing && handleBuyNow(nft.tokenId, nft.listing.price)}
                    onBid={() => {
                      setSelectedTokenId(nft.tokenId);
                      setShowBidModal(true);
                    }}
                    onFinalizeAuction={() => handleFinalizeAuction(nft.tokenId)}
                    isOwner={address?.toLowerCase() === nft.listing?.seller.toLowerCase()}
                    className={`${viewMode === 'list' ? 'flex-row' : ''} transform transition-all duration-300 hover:scale-105 hover:shadow-2xl`}
                  />
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* Enhanced Bid Modal */}
      {showBidModal && selectedTokenId !== null && (() => {
        const currentNFT = nfts.find(nft => nft.tokenId === selectedTokenId);
        const currentListing = currentNFT?.listing;
        const minBid = currentListing?.highestBid && currentListing.highestBid > 0n
          ? currentListing.highestBid + (currentListing.highestBid * 200n) / 10000n
          : currentListing?.price || 0n;

        return (
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-gray-800 rounded-2xl p-8 max-w-md w-full border border-gray-700 shadow-2xl transform transition-all duration-300 scale-100">
              <div className="text-center mb-6">
                <div className="w-16 h-16 bg-gradient-to-r from-blue-600 to-purple-600 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Activity className="w-8 h-8 text-white" />
                </div>
                <h3 className="text-2xl font-bold text-white mb-2">Place Your Bid</h3>
                <p className="text-gray-400">Join the auction for NFT #{selectedTokenId}</p>
              </div>

              {currentListing && (
                <div className="mb-6 p-4 bg-gradient-to-r from-blue-900/20 to-purple-900/20 rounded-xl border border-blue-700/30">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-gray-400 mb-1">Starting Price</p>
                      <p className="text-white font-bold">{formatQTA(currentListing.price)} QTA</p>
                    </div>
                    {currentListing.highestBid > 0n && (
                      <div>
                        <p className="text-gray-400 mb-1">Current Bid</p>
                        <p className="text-green-400 font-bold">
                          {formatQTA(currentListing.highestBid)} QTA
                        </p>
                      </div>
                    )}
                  </div>
                  <div className="mt-4 pt-4 border-t border-gray-700">
                    <p className="text-purple-400 font-medium text-sm">
                      <span className="text-gray-400">Minimum Bid:</span> {formatQTA(minBid)} QTA
                    </p>
                  </div>
                </div>
              )}

              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-300 mb-3">
                  Your Bid Amount (QTA)
                </label>
                <div className="relative">
                  <input
                    type="number"
                    value={bidAmount}
                    onChange={(e) => setBidAmount(e.target.value)}
                    step="0.01"
                    min={formatQTA(minBid)}
                    className="w-full px-4 py-4 bg-gray-700 border border-gray-600 rounded-xl text-white text-lg font-medium focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-300"
                    placeholder={`Min: ${formatQTA(minBid)}`}
                  />
                  <div className="absolute right-4 top-1/2 transform -translate-y-1/2 text-gray-400 font-medium">
                    QTA
                  </div>
                </div>
                {bidAmount && parseFloat(bidAmount) > 0 && (
                  <div className="mt-2 text-sm text-gray-400">
                    ≈ ${(parseFloat(bidAmount) * 1.2).toFixed(2)} USD
                  </div>
                )}
              </div>

              <div className="flex gap-4">
                <button
                  onClick={() => {
                    setShowBidModal(false);
                    setBidAmount('');
                    setSelectedTokenId(null);
                  }}
                  className="flex-1 px-6 py-4 border border-gray-600 text-gray-300 rounded-xl hover:bg-gray-700 hover:text-white transition-all duration-300 font-medium"
                >
                  Cancel
                </button>
                <button
                  onClick={handlePlaceBid}
                  disabled={!bidAmount || parseFloat(bidAmount) <= 0}
                  className="flex-1 px-6 py-4 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-xl hover:from-blue-700 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 font-medium transform hover:scale-105"
                >
                  Place Bid
                </button>
              </div>

              <div className="mt-4 text-xs text-gray-500 text-center">
                By placing a bid, you agree to our terms and conditions
              </div>
            </div>
          </div>
        );
      })()}

      {/* Call to Action Section */}
      <div className="relative bg-gradient-to-br from-slate-800 via-slate-900 to-gray-900 rounded-3xl overflow-hidden border border-slate-700/50 p-8 md:p-12 text-center text-white">
        <div className="absolute inset-0 bg-black/20"></div>
        <div className="relative z-10 max-w-3xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            Ready to Start Your NFT Journey?
          </h2>
          <p className="text-xl opacity-90 mb-8">
            Create your own NFTs or discover amazing collections from talented artists around the world.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/mint"
              className="inline-flex items-center justify-center px-8 py-4 bg-white text-gray-900 rounded-2xl hover:bg-gray-100 transition-all duration-300 font-semibold text-lg transform hover:scale-105"
            >
              <Zap className="mr-2 w-5 h-5" />
              Create Your NFT
            </Link>
            <Link
              href="/my-nfts"
              className="inline-flex items-center justify-center px-8 py-4 border-2 border-white text-white rounded-2xl hover:bg-white hover:text-gray-900 transition-all duration-300 font-semibold text-lg"
            >
              <Package className="mr-2 w-5 h-5" />
              View Collection
            </Link>
          </div>
        </div>
      </div>

    </div>
  );
}