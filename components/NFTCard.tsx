'use client';

import { useState } from 'react';
import Image from 'next/image';
import { Clock, User, Tag, Gavel, ExternalLink } from 'lucide-react';
import { useNFTData } from '@/hooks/useNFTData';
import { formatQTA, formatAddress, formatTimeRemaining, calculateFees } from '@/lib/utils/format';
import { LoadingSpinner } from './ui/LoadingSpinner';
import { getIPFSUrl } from '@/lib/utils/ipfs';
import { CONTRACT_ADDRESSES } from '@/lib/config/contracts';

interface NFTCardProps {
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
  onBuy?: () => void;
  onBid?: () => void;
  onList?: () => void;
  onDelist?: () => void;
  onFinalizeAuction?: () => void;
  showActions?: boolean;
  isOwner?: boolean;
  className?: string;
}

export function NFTCard({
  tokenId,
  listing,
  onBuy,
  onBid,
  onList,
  onDelist,
  onFinalizeAuction,
  showActions = true,
  isOwner = false,
  className = '',
}: NFTCardProps) {
  const { metadata, owner, loading, error } = useNFTData(tokenId);
  const [imageError, setImageError] = useState(false);

  if (loading) {
    return (
      <div className={`bg-gray-800 rounded-xl shadow-md overflow-hidden border border-gray-700 ${className}`}>
        <div className="aspect-square bg-gray-700 flex items-center justify-center">
          <LoadingSpinner size="lg" />
        </div>
        <div className="p-4">
          <div className="h-6 bg-gray-700 rounded animate-pulse mb-2" />
          <div className="h-4 bg-gray-700 rounded animate-pulse w-2/3" />
        </div>
      </div>
    );
  }

  if (error || !metadata) {
    return (
      <div className={`bg-gray-800 rounded-xl shadow-md overflow-hidden border border-gray-700 ${className}`}>
        <div className="aspect-square bg-gray-700 flex items-center justify-center">
          <p className="text-gray-400">Failed to load NFT</p>
        </div>
      </div>
    );
  }

  const imageUrl = metadata.image?.startsWith('ipfs://') 
    ? getIPFSUrl(metadata.image.replace('ipfs://', ''))
    : metadata.image;

  const isAuction = listing?.isAuction;
  const timeRemaining = listing?.auctionEndTime 
    ? Math.max(0, listing.auctionEndTime - Math.floor(Date.now() / 1000))
    : 0;
  const isAuctionEnded = listing?.isAuction && timeRemaining === 0;
  const canFinalize = isAuctionEnded && listing?.highestBidder !== '0x0000000000000000000000000000000000000000';

  return (
    <div className={`bg-gray-800 rounded-xl shadow-md hover:shadow-xl transition-all duration-300 overflow-hidden group border border-gray-700 ${className}`}>
      {/* Image */}
      <div className="aspect-square relative overflow-hidden bg-gray-700">
        {!imageError ? (
          <Image
            src={imageUrl}
            alt={metadata.name}
            fill
            className="object-cover group-hover:scale-105 transition-transform duration-300"
            onError={() => setImageError(true)}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-gray-700 to-gray-800">
            <span className="text-gray-400 text-4xl">🖼️</span>
          </div>
        )}
        
        {/* Status Badge */}
        {listing?.active && (
          <div className="absolute top-3 left-3">
            <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
              isAuction 
                ? 'bg-purple-600 text-white' 
                : 'bg-green-600 text-white'
            }`}>
              {isAuction ? (
                <>
                  <Gavel className="w-3 h-3 mr-1" />
                  Auction
                </>
              ) : (
                <>
                  <Tag className="w-3 h-3 mr-1" />
                  Sale
                </>
              )}
            </span>
          </div>
        )}

        {/* Time Remaining for Auctions */}
        {isAuction && (
          <div className="absolute top-3 right-3 bg-black bg-opacity-70 text-white px-2 py-1 rounded-lg text-xs flex items-center">
            <Clock className="w-3 h-3 mr-1" />
            {timeRemaining > 0 ? formatTimeRemaining(timeRemaining) : 'Ended'}
          </div>
        )}
      </div>

      {/* Content */}
      <div className="p-4">
        <div className="flex items-start justify-between mb-3">
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-white truncate">{metadata.name}</h3>
            {metadata.description && (
              <p className="text-sm text-gray-400 line-clamp-2 mt-1">
                {metadata.description}
              </p>
            )}
          </div>
          <a
            href={`https://sepolia.etherscan.io/token/${CONTRACT_ADDRESSES.NFT_COLLECTION}?a=${tokenId}`}
            target="_blank"
            rel="noopener noreferrer"
            className="p-1 text-gray-400 hover:text-gray-300 ml-2"
            title="View on Etherscan"
          >
            <ExternalLink className="w-4 h-4" />
          </a>
        </div>

        {/* Owner */}
        <div className="flex items-center text-sm text-gray-400 mb-3">
          <User className="w-4 h-4 mr-1" />
          <span>
            {isOwner ? 'You' : formatAddress(owner)}
          </span>
        </div>

        {/* Price Information */}
        {listing?.active && (
          <div className="mb-4">
            {isAuction ? (
              <div className="space-y-1">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-400">Starting Bid</span>
                  <span className="font-semibold text-white">
                    {formatQTA(listing.price)} QTA
                  </span>
                </div>
                {listing.highestBid > 0n && (
                  <>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-400">Current Bid</span>
                      <span className="font-semibold text-purple-400">
                        {formatQTA(listing.highestBid)} QTA
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-400">Highest Bidder</span>
                      <span className="font-semibold text-purple-400 text-xs">
                        {formatAddress(listing.highestBidder)}
                      </span>
                    </div>
                  </>
                )}
                {isAuctionEnded && listing.highestBid > 0n && (
                  <div className="mt-2 p-2 bg-green-900 border border-green-700 rounded-lg">
                    <div className="text-sm text-green-300 font-medium">
                      🏆 Auction Winner: {formatAddress(listing.highestBidder)}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-1">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-400">Price</span>
                  <span className="font-semibold text-white text-lg">
                    {formatQTA(listing.price)} QTA
                  </span>
                </div>
                {/* Fee breakdown */}
                {(() => {
                  const fees = calculateFees(listing.price);
                  return (
                    <div className="text-xs text-gray-500 space-y-0.5">
                      <div className="flex justify-between">
                        <span>Platform Fee (5%):</span>
                        <span>{formatQTA(fees.platformFee)} QTA</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Creator Royalty (5%):</span>
                        <span>{formatQTA(fees.creatorRoyalty)} QTA</span>
                      </div>
                      <div className="flex justify-between font-medium">
                        <span>Seller Receives:</span>
                        <span>{formatQTA(fees.sellerAmount)} QTA</span>
                      </div>
                    </div>
                  );
                })()}
              </div>
            )}
          </div>
        )}

        {/* Attributes */}
        {metadata.attributes && metadata.attributes.length > 0 && (
          <div className="mb-4">
            <div className="flex flex-wrap gap-1">
              {metadata.attributes.slice(0, 3).map((attr, index) => (
                <span
                  key={index}
                  className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-blue-600 text-white"
                >
                  {attr.trait_type}: {attr.value}
                </span>
              ))}
              {metadata.attributes.length > 3 && (
                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-gray-700 text-gray-300">
                  +{metadata.attributes.length - 3} more
                </span>
              )}
            </div>
          </div>
        )}

        {/* Actions */}
        {showActions && (
          <div className="space-y-2">
            {listing?.active ? (
              <>
                {!isOwner && (
                  <>
                    {isAuction ? (
                      timeRemaining > 0 ? (
                        <button
                          onClick={onBid}
                          className="w-full bg-purple-600 text-white py-2 px-4 rounded-lg hover:bg-purple-700 transition-colors font-medium"
                        >
                          Place Bid
                        </button>
                      ) : canFinalize ? (
                        <button
                          onClick={onFinalizeAuction}
                          className="w-full bg-orange-600 text-white py-2 px-4 rounded-lg hover:bg-orange-700 transition-colors font-medium"
                        >
                          Finalize Auction
                        </button>
                      ) : (
                        <div className="text-center text-sm text-gray-400 py-2">
                          Auction ended - no bids
                        </div>
                      )
                    ) : (
                      <button
                        onClick={onBuy}
                        className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 transition-colors font-medium"
                      >
                        Buy Now
                      </button>
                    )}
                  </>
                )}
                {isOwner && (
                  <button
                    onClick={onDelist}
                    className="w-full bg-red-600 text-white py-2 px-4 rounded-lg hover:bg-red-700 transition-colors font-medium"
                  >
                    Delist
                  </button>
                )}
              </>
            ) : (
              isOwner && (
                <button
                  onClick={onList}
                  className="w-full bg-green-600 text-white py-2 px-4 rounded-lg hover:bg-green-700 transition-colors font-medium"
                >
                  List for Sale
                </button>
              )
            )}
          </div>
        )}
      </div>
    </div>
  );
}