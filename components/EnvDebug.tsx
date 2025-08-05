'use client';

export function EnvDebug() {
  return (
    <div className="p-4 bg-yellow-100 rounded-lg mb-4">
      <h3 className="font-bold mb-2">Environment Variables Debug:</h3>
      <div className="text-sm space-y-1">
        <div>NEXT_PUBLIC_PINATA_JWT: {process.env.NEXT_PUBLIC_PINATA_JWT ? 'SET' : 'NOT SET'}</div>
        <div>NEXT_PUBLIC_GATEWAY_URL: {process.env.NEXT_PUBLIC_GATEWAY_URL || 'NOT SET'}</div>
        <div>NEXT_PUBLIC_QTA_TOKEN_ADDRESS: {process.env.NEXT_PUBLIC_QTA_TOKEN_ADDRESS || 'NOT SET'}</div>
        <div>NEXT_PUBLIC_NFT_COLLECTION_ADDRESS: {process.env.NEXT_PUBLIC_NFT_COLLECTION_ADDRESS || 'NOT SET'}</div>
        <div>NEXT_PUBLIC_MARKETPLACE_ADDRESS: {process.env.NEXT_PUBLIC_MARKETPLACE_ADDRESS || 'NOT SET'}</div>
      </div>
    </div>
  );
} 