'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Home,
  ShoppingBag,
  Package,
  Zap,
  Gavel,
  Settings,
  Search
} from 'lucide-react';
import { useAccount } from 'wagmi';
import { useQTABalance } from '@/hooks/useQTABalance';
import { formatQTA } from '@/lib/utils/format';
import { WalletConnection } from './WalletConnection';
import { cn } from '@/lib/utils';

const navigation = [
  { name: 'Dashboard', href: '/', icon: Home },
  { name: 'Marketplace', href: '/marketplace', icon: ShoppingBag },
  { name: 'Mint', href: '/mint', icon: Zap },
  { name: 'My NFTs', href: '/my-nfts', icon: Package },
  { name: 'Auctions', href: '/auctions', icon: Gavel },
  { name: 'Admin  Panel', href: '/collection', icon: Settings },
];

const creators = [
  { name: 'Huzaifa Khan', handle: '@HuzaifaKhanDev', isFollowing: true },
];

export function Navigation({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { isConnected } = useAccount();
  const { balance } = useQTABalance();

  return (
    <div className="flex h-screen bg-gray-900">
      {/* Sidebar */}
      <div className="w-64 bg-gradient-to-br from-slate-800 via-slate-900 to-gray-900 border-r border-slate-700/50 flex flex-col hidden lg:flex">
        {/* Header */}
        <div className="p-6 border-b border-slate-700/50">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-gradient-to-r from-violet-600 to-indigo-600 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-sm">Q</span>
            </div>
            <div>
              <h1 className="text-white font-semibold text-sm">Quanta Marketplace</h1>
              <div className="flex items-center space-x-2">
                <span className="text-xs text-emerald-400">Online</span>
                <div className="w-2 h-2 bg-emerald-400 rounded-full"></div>
              </div>
            </div>
          </div>

          {/* Balance */}
          <div className="mt-4 p-3 bg-gradient-to-r from-slate-700 to-slate-800 rounded-lg">
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-300">Balance</span>
              <span className="text-xs text-emerald-400">
                {isConnected ? formatQTA(balance as bigint || 0n) : '0'} QTA
              </span>
            </div>
          </div>
        </div>

        {/* Navigation Links */}
        <nav className="flex-1 p-4 space-y-2">
          {navigation.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.name}
                href={item.href}
                className={cn(
                  'flex items-center space-x-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-gradient-to-r from-violet-600 to-indigo-600 text-white'
                    : 'text-slate-300 hover:text-white hover:bg-gradient-to-r hover:from-slate-700 hover:to-slate-800'
                )}
              >
                <item.icon className="w-4 h-4" />
                <span>{item.name}</span>
              </Link>
            );
          })}
        </nav>

        {/* Creators Section */}
        <div className="p-4 border-t border-slate-700/50">
          <h3 className="text-xs font-semibold text-slate-400 mb-3 uppercase tracking-wider">
            Popular Creators
          </h3>
          <div className="space-y-2">
            {creators.map((creator) => (
              <div key={creator.handle} className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <div className="w-6 h-6 bg-gradient-to-r from-pink-500 to-purple-500 rounded-full"></div>
                  <div>
                    <p className="text-xs text-white font-medium">{creator.name}</p>
                    <p className="text-xs text-slate-400">{creator.handle}</p>
                  </div>
                </div>
                <button
                  className={cn(
                    'text-xs px-2 py-1 rounded-full transition-colors',
                    creator.isFollowing
                      ? 'bg-slate-700 text-slate-300'
                      : 'bg-gradient-to-r from-violet-600 to-indigo-600 text-white hover:from-violet-700 hover:to-indigo-700'
                  )}
                >
                  {creator.isFollowing ? 'Following' : 'Follow'}
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Earn Section */}
        <div className="p-4 border-t border-slate-700/50">
          <div className="bg-gradient-to-br from-slate-800 via-slate-900 to-gray-900 rounded-lg p-3 border border-slate-700/50">
            <h3 className="text-xs font-semibold text-white mb-1">Earn up to</h3>
            <p className="text-lg font-bold text-white">$2,500</p>
            <p className="text-xs text-slate-300">Create and sell your NFTs</p>
          </div>
        </div>

      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col">
        {/* Top Bar */}
        <div className="bg-gradient-to-br from-slate-800 via-slate-900 to-gray-900 border-b border-slate-700/50 p-4">
          <div className="flex items-center justify-between">
            {/* Mobile Menu Button */}
            <button className="lg:hidden p-2 text-slate-400 hover:text-white">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>

            <div className="flex-1 max-w-md mx-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
                <input
                  type="text"
                  placeholder="Search items, collection, accounts"
                  className="w-full pl-10 pr-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:ring-2 focus:ring-violet-500 focus:border-transparent"
                />
              </div>
            </div>
            <WalletConnection />
          </div>
        </div>

        {/* Page Content */}
        <div className="flex-1 overflow-auto">
          <div className="p-4 lg:p-6">
            {children}
          </div>
        </div>
      </div>

      {/* Mobile Sidebar Overlay */}
      <div className="lg:hidden fixed inset-0 bg-black bg-opacity-50 z-40 hidden">
        <div className="w-64 h-full bg-gray-800 border-r border-gray-700 flex flex-col">
          {/* Mobile Header */}
          <div className="p-6 border-b border-gray-700">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
                  <span className="text-white font-bold text-sm">Q</span>
                </div>
                <div>
                  <h1 className="text-white font-semibold text-sm">Quanta Marketplace</h1>
                  <div className="flex items-center space-x-2">
                    <span className="text-xs text-green-400">Online</span>
                    <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                  </div>
                </div>
              </div>
              <button className="text-gray-400 hover:text-white">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Balance */}
            <div className="mt-4 p-3 bg-gray-700 rounded-lg">
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-300">Balance</span>
                <span className="text-xs text-green-400">
                  {isConnected ? formatQTA(balance as bigint || 0n) : '0'} QTA
                </span>
              </div>
            </div>
          </div>

          {/* Mobile Navigation Links */}
          <nav className="flex-1 p-4 space-y-2">
            {navigation.map((item) => {
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={cn(
                    'flex items-center space-x-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                    isActive
                      ? 'bg-blue-600 text-white'
                      : 'text-gray-300 hover:text-white hover:bg-gray-700'
                  )}
                >
                  <item.icon className="w-4 h-4" />
                  <span>{item.name}</span>
                </Link>
              );
            })}
          </nav>

          {/* Mobile Creators Section */}
          <div className="p-4 border-t border-gray-700">
            <h3 className="text-xs font-semibold text-gray-400 mb-3 uppercase tracking-wider">
              Popular Creators
            </h3>
            <div className="space-y-2">
              {creators.map((creator) => (
                <div key={creator.handle} className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <div className="w-6 h-6 bg-gradient-to-r from-pink-500 to-purple-500 rounded-full"></div>
                    <div>
                      <p className="text-xs text-white font-medium">{creator.name}</p>
                      <p className="text-xs text-gray-400">{creator.handle}</p>
                    </div>
                  </div>
                  <button
                    className={cn(
                      'text-xs px-2 py-1 rounded-full transition-colors',
                      creator.isFollowing
                        ? 'bg-gray-600 text-gray-300'
                        : 'bg-blue-600 text-white hover:bg-blue-700'
                    )}
                  >
                    {creator.isFollowing ? 'Following' : 'Follow'}
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Mobile Earn Section */}
          <div className="p-4 border-t border-gray-700">
            <div className="bg-gradient-to-r from-purple-600 to-pink-600 rounded-lg p-3">
              <h3 className="text-xs font-semibold text-white mb-1">Earn up to</h3>
              <p className="text-lg font-bold text-white">$2,500</p>
              <p className="text-xs text-purple-200">Create and sell your NFTs</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}