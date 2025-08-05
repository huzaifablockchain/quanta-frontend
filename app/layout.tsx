import './globals.css';
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { Providers } from './providers';
import { Navigation } from '@/components/Navigation';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Quanta NFT Marketplace',
  description: 'A modern NFT marketplace built on Ethereum with QTA token integration',
  keywords: ['NFT', 'Marketplace', 'Ethereum', 'Web3', 'QTA', 'Blockchain'],
  authors: [{ name: 'Quanta Marketplace' }],
  openGraph: {
    title: 'Quanta NFT Marketplace',
    description: 'Discover, collect, and trade unique NFTs with QTA tokens',
    type: 'website',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={`${inter.className} bg-gray-900 min-h-screen`}>
        <Providers>
          <Navigation>
            {children}
          </Navigation>
        </Providers>
      </body>
    </html>
  );
}