'use client';

import Link from 'next/link';
import { ArrowRight, Zap, ShoppingBag, Package, TrendingUp, Shield, Coins, Flame, Palette, Gamepad2, Music, Trophy, Camera, Eye, Heart, Star, Clock, Users, Gavel } from 'lucide-react';
import { useAccount, useReadContract, usePublicClient } from 'wagmi';
import { useQTABalance } from '@/hooks/useQTABalance';
import { formatQTA } from '@/lib/utils/format';
import { CONTRACT_ADDRESSES, MARKETPLACE_ABI, NFT_COLLECTION_ABI } from '@/lib/config/contracts';
import { NFTCard } from '@/components/NFTCard';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { useState, useEffect } from 'react';

const categories = [
  { name: 'All', icon: Flame, active: true },
  { name: 'Art', icon: Palette, active: false },
  { name: 'Gaming', icon: Gamepad2, active: false },
  { name: 'Music', icon: Music, active: false },
  { name: 'Sports', icon: Trophy, active: false },
  { name: 'Photography', icon: Camera, active: false },
];

const trendingCollections = [
  {
    name: "QuantaVerse",
    floorPrice: "38 QTA",
    change: "+30.5%",
    volume: "1.2K QTA",
    items: 3,
    image: "https://images.unsplash.com/photo-1617791160536-598cf32026fb?w=80&h=80&fit=crop",
    verified: true
  }
];

const topCreators = [
  {
    name: "Huzaifa Khan",
    username: "@Huzaifa Khan",
    avatar: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=60&h=60&fit=crop&crop=face",
    sales: "999.85M QTA",
    change: "+85.99%"
  }
];

export default function HomePage() {
  const { isConnected } = useAccount();
  const { balance, isLoading } = useQTABalance();
  const publicClient = usePublicClient();
  
  const [liveAuctions, setLiveAuctions] = useState<Array<{ tokenId: number; listing: any }>>([]);
  const [loadingAuctions, setLoadingAuctions] = useState(true);

  // Get total minted to know which tokens exist
  const { data: totalMinted } = useReadContract({
    address: CONTRACT_ADDRESSES.NFT_COLLECTION,
    abi: NFT_COLLECTION_ABI,
    functionName: 'totalMinted',
  });

  // Load live auctions
  const loadLiveAuctions = async () => {
    if (!totalMinted || !publicClient) return;
    
    setLoadingAuctions(true);
    const auctions: Array<{ tokenId: number; listing: any }> = [];
    
    try {
      // Check each token for active auction listings
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
            if (timeRemaining > 0) {
              auctions.push({
                tokenId: i,
                listing: {
                  seller: listing.seller,
                  price: listing.price,
                  isAuction: listing.isAuction,
                  auctionEndTime: Number(listing.auctionEndTime),
                  highestBidder: listing.highestBidder,
                  highestBid: listing.highestBid,
                  active: listing.active,
                },
              });
            }
          }
        } catch (error) {
          continue;
        }
      }
      
      setLiveAuctions(auctions.slice(0, 4)); // Show only first 4 auctions
    } catch (error) {
      console.error('Error loading live auctions:', error);
    } finally {
      setLoadingAuctions(false);
    }
  };

  useEffect(() => {
    loadLiveAuctions();
  }, [totalMinted, publicClient]);

  return (
    <div className="space-y-12">
      {/* Hero Section */}
      <div className="relative bg-gradient-to-br from-slate-800 via-slate-900 to-gray-900 rounded-3xl overflow-hidden border border-slate-700/50">
        <div className="absolute inset-0 bg-black/20"></div>
        <div className="relative z-10 p-8 md:p-16">
          <div className="max-w-6xl mx-auto">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
              <div className="text-white">
                <div className="inline-flex items-center bg-white/10 backdrop-blur-sm rounded-full px-4 py-2 mb-6">
                  <TrendingUp className="w-4 h-4 mr-2" />
                  <span className="text-sm font-medium">Trending Now</span>
                </div>
                
                <h1 className="text-5xl md:text-7xl font-bold mb-6 leading-tight">
                  Discover, collect, and sell 
                  <span className="bg-gradient-to-r from-violet-400 to-indigo-400 bg-clip-text text-transparent"> extraordinary </span>
                  NFTs
                </h1>
                
                <p className="text-xl text-white/80 mb-8 max-w-xl">
                  The world's first and largest digital marketplace for crypto collectibles and non-fungible tokens (NFTs).
                </p>

                {isConnected && (
                  <div className="bg-gradient-to-r from-slate-700 to-slate-800 backdrop-blur-sm rounded-2xl p-6 mb-8 border border-slate-600/50">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-gradient-to-r from-violet-600 to-indigo-600 rounded-xl flex items-center justify-center">
                        <Coins className="w-6 h-6 text-white" />
                      </div>
                      <div>
                        <p className="text-slate-300 text-sm">Your Balance</p>
                        <p className="text-2xl font-bold text-white">
                          {formatQTA(balance as bigint || 0n)} QTA
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                <div className="flex flex-col sm:flex-row gap-4">
                  <Link
                    href="/marketplace"
                    className="inline-flex items-center justify-center px-8 py-4 bg-gradient-to-r from-violet-600 to-indigo-600 text-white rounded-2xl hover:from-violet-700 hover:to-indigo-700 transition-all duration-300 font-semibold text-lg transform hover:scale-105"
                  >
                    <Eye className="mr-2 w-5 h-5" />
                    Explore Marketplace
                  </Link>
                  <Link
                    href="/mint"
                    className="inline-flex items-center justify-center px-8 py-4 border-2 border-slate-300 text-white rounded-2xl hover:bg-slate-300 hover:text-gray-900 transition-all duration-300 font-semibold text-lg"
                  >
                    <Zap className="mr-2 w-5 h-5" />
                    Create NFT
                  </Link>
                </div>
              </div>

              <div className="relative">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-4">
                    <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-4 border border-white/20">
                      <div className="aspect-w-1 aspect-h-1">
                        <img
                          src="https://i2.seadn.io/ethereum/0x8a90cab2b38dba80c64b7734e58ee1db38b8992e/7c8f36724756afe46fdf406fdae3d433.png?w=1000000000"
                          alt="NFT"
                          className="w-full h-full object-cover rounded-xl mb-3"
                        />
                      </div>
                      <p className="text-white font-medium text-sm">Doodle in space</p>
                      <p className="text-white/60 text-xs">5 QTA</p>
                    </div>
                    <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-4 border border-white/20 transform translate-x-8">
                      <img src="https://i2.seadn.io/ethereum/0xb47e3cd837ddf8e4c57f05d70ab865de6e193bbb/67fc91ff36238e9d2dd44825ee48d3/5067fc91ff36238e9d2dd44825ee48d3.png?w=1000" alt="NFT" className="w-full h-full object-cover rounded-xl mb-3" />
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
                        />                      <p className="text-white font-medium text-sm">Azuki</p>
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

      {/* Stats Section */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
        <div className="bg-gray-800/50 backdrop-blur-sm rounded-2xl p-6 border border-gray-700">
          <div className="text-3xl md:text-4xl font-bold text-white mb-2">10+</div>
          <div className="text-gray-400 font-medium">Total NFTs</div>
          <div className="text-green-400 text-sm mt-1">+52% this week</div>
        </div>
        <div className="bg-gray-800/50 backdrop-blur-sm rounded-2xl p-6 border border-gray-700">
          <div className="text-3xl md:text-4xl font-bold text-white mb-2">12+</div>
          <div className="text-gray-400 font-medium">Active Users</div>
          <div className="text-green-400 text-sm mt-1">+43% this week</div>
        </div>
        <div className="bg-gray-800/50 backdrop-blur-sm rounded-2xl p-6 border border-gray-700">
          <div className="text-3xl md:text-4xl font-bold text-white mb-2">1.2K+ QTA</div>
          <div className="text-gray-400 font-medium">Volume Traded</div>
          <div className="text-green-400 text-sm mt-1">+80% this week</div>
        </div>
        <div className="bg-gray-800/50 backdrop-blur-sm rounded-2xl p-6 border border-gray-700">
          <div className="text-3xl md:text-4xl font-bold text-white mb-2">1</div>
          <div className="text-gray-400 font-medium">Collections</div>
          <div className="text-green-400 text-sm mt-1">+1% this week</div>
        </div>
      </div>

      {/* Categories */}
      <div>
        <h2 className="text-3xl font-bold text-white mb-8">Browse by Category</h2>
        <div className="flex flex-wrap gap-4">
          {categories.map((category) => (
            <button
              key={category.name}
              className={`flex items-center space-x-3 px-6 py-3 rounded-2xl transition-all duration-300 border ${
                category.active
                  ? 'bg-gradient-to-r from-violet-600 to-indigo-600 text-white border-transparent'
                  : 'bg-slate-800/50 text-slate-300 hover:bg-slate-700 hover:text-white border-slate-700 hover:border-slate-600'
              }`}
            >
              <category.icon className="w-5 h-5" />
              <span className="font-medium">{category.name}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Trending Collections */}
      <div>
        <div className="flex items-center justify-between mb-8">
          <h2 className="text-3xl font-bold text-white">Trending Collections</h2>
          {/* <Link href="/my-nfts" className="text-blue-400 hover:text-blue-300 font-medium flex items-center">
            View All <ArrowRight className="ml-1 w-4 h-4" />
          </Link> */}
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {trendingCollections.map((collection, index) => (
            <div key={collection.name} className="bg-gray-800/50 backdrop-blur-sm rounded-2xl p-6 border border-gray-700 hover:border-gray-600 transition-all duration-300 group">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-3">
                  <div className="relative">
                    <img src={collection.image} alt={collection.name} className="w-12 h-12 rounded-xl" />
                    {collection.verified && (
                      <div className="absolute -top-1 -right-1 w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center">
                        <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      </div>
                    )}
                  </div>
                  <div>
                    <h3 className="text-white font-semibold">{collection.name}</h3>
                    <p className="text-gray-400 text-sm">{collection.items.toLocaleString()} items</p>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-2xl font-bold text-white">#{index + 1}</span>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-gray-400 text-sm">Floor Price</p>
                  <p className="text-white font-semibold">{collection.floorPrice}</p>
                </div>
                <div>
                  <p className="text-gray-400 text-sm">24h Change</p>
                  <p className={`font-semibold ${collection.change.startsWith('+') ? 'text-green-400' : 'text-red-400'}`}>
                    {collection.change}
                  </p>
                </div>
              </div>
              
              <div className="mt-4 pt-4 border-t border-gray-700">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Volume</span>
                  <span className="text-white font-medium">{collection.volume}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Live Auctions */}
      <div>
        <div className="flex items-center justify-between mb-8">
          <h2 className="text-3xl font-bold text-white">Live Auctions</h2>
          {/* <Link href="/auctions" className="text-violet-400 hover:text-violet-300 font-medium flex items-center">
            View All <ArrowRight className="ml-1 w-4 h-4" />
          </Link> */}
        </div>
        
        {loadingAuctions ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="bg-slate-800/50 backdrop-blur-sm rounded-2xl overflow-hidden border border-slate-700 animate-pulse">
                <div className="h-48 bg-slate-700"></div>
                <div className="p-4 space-y-3">
                  <div className="h-4 bg-slate-700 rounded"></div>
                  <div className="h-3 bg-slate-700 rounded w-2/3"></div>
                  <div className="h-8 bg-slate-700 rounded"></div>
                </div>
              </div>
            ))}
          </div>
        ) : liveAuctions.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {liveAuctions.map((auction) => (
              <NFTCard
                key={auction.tokenId}
                tokenId={auction.tokenId}
                listing={auction.listing}
                showActions={true}
                className="bg-slate-800/50 backdrop-blur-sm border-slate-700 hover:border-slate-600"
              />
            ))}
          </div>
        ) : (
          <div className="text-center py-12">
            <div className="bg-slate-800/50 backdrop-blur-sm rounded-2xl p-8 border border-slate-700">
              <Gavel className="w-16 h-16 text-slate-400 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-white mb-2">No Live Auctions</h3>
              <p className="text-slate-400 mb-4">
                There are currently no active auctions. Check back later or create your own auction!
              </p>
              <Link
                href="/mint"
                className="inline-flex items-center px-6 py-3 bg-gradient-to-r from-violet-600 to-indigo-600 text-white rounded-xl hover:from-violet-700 hover:to-indigo-700 transition-all duration-300"
              >
                <Zap className="mr-2 w-4 h-4" />
                Create NFT
              </Link>
            </div>
          </div>
        )}
      </div>

      {/* Top Creators */}
      <div>
        <div className="flex items-center justify-between mb-8">
          <h2 className="text-3xl font-bold text-white">Top Creators</h2>
          {/* <Link href="/creators" className="text-violet-400 hover:text-violet-300 font-medium flex items-center">
            View All <ArrowRight className="ml-1 w-4 h-4" />
          </Link> */}
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {topCreators.map((creator, index) => (
            <div key={creator.username} className="bg-slate-800/50 backdrop-blur-sm rounded-2xl p-6 border border-slate-700 hover:border-slate-600 transition-all duration-300">
              <div className="flex items-center space-x-4 mb-4">
                <div className="relative">
                  <img src={creator.avatar} alt={creator.name} className="w-16 h-16 rounded-full" />
                  <div className="absolute -top-1 -right-1 w-6 h-6 bg-gradient-to-r from-violet-600 to-indigo-600 rounded-full flex items-center justify-center text-white text-xs font-bold">
                    {index + 1}
                  </div>
                </div>
                <div className="flex-1">
                  <h3 className="text-white font-semibold">{creator.name}</h3>
                  <p className="text-gray-400 text-sm">{creator.username}</p>
                </div>
              </div>
              
              <div className="flex justify-between items-center">
                <div>
                  <p className="text-gray-400 text-sm">Total Sales</p>
                  <p className="text-white font-bold text-lg">{creator.sales}</p>
                </div>
                <div className="text-right">
                  <p className="text-green-400 font-semibold">{creator.change}</p>
                  <p className="text-gray-400 text-sm">3 days</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Newsletter Section */}
      <div className="bg-gradient-to-r from-slate-800 via-slate-900 to-gray-900 rounded-3xl p-8 md:p-12 text-center text-white relative overflow-hidden border border-slate-700/50">
        <div className="absolute inset-0 bg-black/20"></div>
        <div className="relative z-10 max-w-3xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            Never Miss a Drop
          </h2>
          <p className="text-xl text-slate-300 mb-8">
            Subscribe to our newsletter and be the first to know about new collections, trending artists, and exclusive drops.
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4 max-w-lg mx-auto">
            <input
              type="email"
              placeholder="Enter your email"
              className="flex-1 px-6 py-4 rounded-2xl bg-slate-700/50 backdrop-blur-sm border border-slate-600/50 text-white placeholder-slate-400 focus:outline-none focus:border-slate-500 focus:ring-2 focus:ring-violet-500"
            />
            <button className="px-8 py-4 bg-gradient-to-r from-violet-600 to-indigo-600 text-white rounded-2xl hover:from-violet-700 hover:to-indigo-700 transition-all duration-300 font-semibold">
              Subscribe
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}