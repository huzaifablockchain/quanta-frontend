import QuantaTokenABI from './abis/QuantaToken.json';
import QTANFTCollectionABI from './abis/QTANFTCollection.json';
import QTANFTMarketplaceABI from './abis/QTANFTMarketplace.json';

export const CONTRACT_ADDRESSES = {
  QTA_TOKEN: process.env.NEXT_PUBLIC_QTA_TOKEN_ADDRESS as `0x${string}`,
  NFT_COLLECTION: process.env.NEXT_PUBLIC_NFT_COLLECTION_ADDRESS as `0x${string}`,
  MARKETPLACE: process.env.NEXT_PUBLIC_MARKETPLACE_ADDRESS as `0x${string}`,
} as const;

export const QTA_TOKEN_ABI = QuantaTokenABI as any;

export const NFT_COLLECTION_ABI = QTANFTCollectionABI as any;

export const MARKETPLACE_ABI = QTANFTMarketplaceABI as any;