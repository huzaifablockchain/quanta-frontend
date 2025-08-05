'use client';

import { getDefaultConfig } from '@rainbow-me/rainbowkit';
import { sepolia } from 'wagmi/chains';

export const config = getDefaultConfig({
  appName: 'QTA NFT Marketplace',
  projectId: '1fc501f0fa9bbe59716f6840af9e60fb',
  chains: [sepolia],
  ssr: true,
});

export const SUPPORTED_CHAINS = [sepolia];