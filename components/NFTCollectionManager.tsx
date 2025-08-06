'use client';

import { useState, useEffect } from 'react';
import { useAccount, useReadContract, useWriteContract, usePublicClient } from 'wagmi';
import { Package, Upload, Settings, DollarSign, Users, BarChart3 } from 'lucide-react';
import { CONTRACT_ADDRESSES, NFT_COLLECTION_ABI } from '@/lib/config/contracts';
import { formatQTA, parseQTA } from '@/lib/utils/format';
import { LoadingSpinner } from './ui/LoadingSpinner';
import { uploadToIPFS } from '@/lib/utils/ipfs';
import toast from 'react-hot-toast';

interface CollectionStats {
  totalMinted: bigint;
  mintingFee: bigint;
  maxMintsPerAddress: bigint;
  accumulatedFees: bigint;
  nextTokenId: bigint;
}

interface BatchMintForm {
  files: File[];
  names: string[];
  descriptions: string[];
  attributes: Array<{ trait_type: string; value: string }>[];
}

export function NFTCollectionManager() {
  const { address, isConnected } = useAccount();
  const { writeContract } = useWriteContract();
  const publicClient = usePublicClient();

  // Get contract owner
  const { data: contractOwner } = useReadContract({
    address: CONTRACT_ADDRESSES.NFT_COLLECTION,
    abi: NFT_COLLECTION_ABI,
    functionName: 'owner',
  });

  // Authorized addresses - owner and specific address
  const AUTHORIZED_ADDRESSES = [
    '0x8b616c6FD7E716eEEe89DEf331Ce99D8C8C1E894'
  ];

  // Check if current user is authorized (owner or specific address)
  const isAuthorized = isConnected && address && (
    (contractOwner as string)?.toLowerCase() === address.toLowerCase() ||
    AUTHORIZED_ADDRESSES.includes(address.toLowerCase()) ||
    AUTHORIZED_ADDRESSES.includes(address)
  );

  const [stats, setStats] = useState<CollectionStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [showBatchMint, setShowBatchMint] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [batchForm, setBatchForm] = useState<BatchMintForm>({
    files: [],
    names: [],
    descriptions: [],
    attributes: [],
  });
  const [newMintingFee, setNewMintingFee] = useState('');
  const [newMaxMints, setNewMaxMints] = useState('');

  // Load collection statistics
  const loadStats = async () => {
    if (!publicClient) return;

    setLoading(true);
    try {
      const [
        totalMinted,
        mintingFee,
        maxMintsPerAddress,
        accumulatedFees,
        nextTokenId,
      ] = await Promise.all([
        publicClient.readContract({
          address: CONTRACT_ADDRESSES.NFT_COLLECTION,
          abi: NFT_COLLECTION_ABI,
          functionName: 'totalMinted',
          args: [],
        }),
        publicClient.readContract({
          address: CONTRACT_ADDRESSES.NFT_COLLECTION,
          abi: NFT_COLLECTION_ABI,
          functionName: 'mintingFee',
          args: [],
        }),
        publicClient.readContract({
          address: CONTRACT_ADDRESSES.NFT_COLLECTION,
          abi: NFT_COLLECTION_ABI,
          functionName: 'maxMintsPerAddress',
          args: [],
        }),
        publicClient.readContract({
          address: CONTRACT_ADDRESSES.NFT_COLLECTION,
          abi: NFT_COLLECTION_ABI,
          functionName: 'accumulatedMintingFees',
          args: [],
        }),
        publicClient.readContract({
          address: CONTRACT_ADDRESSES.NFT_COLLECTION,
          abi: NFT_COLLECTION_ABI,
          functionName: 'nextTokenId',
          args: [],
        }),
      ]);

      setStats({
        totalMinted: totalMinted as bigint,
        mintingFee: mintingFee as bigint,
        maxMintsPerAddress: maxMintsPerAddress as bigint,
        accumulatedFees: accumulatedFees as bigint,
        nextTokenId: nextTokenId as bigint,
      });
    } catch (error) {
      console.error('Error loading collection stats:', error);
      toast.error('Failed to load collection statistics');
    } finally {
      setLoading(false);
    }
  };

  const baseNextId: bigint = (stats && typeof stats.nextTokenId === 'bigint')
    ? stats.nextTokenId
    : 0n;

  const handleBatchMint = async () => {
    if (!isConnected || batchForm.files.length === 0) return;

    setLoading(true);
    try {
      const tokenURIs: string[] = [];

      // Upload each file and create metadata
      for (let i = 0; i < batchForm.files.length; i++) {
        const file = batchForm.files[i];
        const name = batchForm.names[i] || `NFT #${(baseNextId + BigInt(i)).toString()}`;
        const description = batchForm.descriptions[i] || '';
        const attributes = batchForm.attributes[i] || [];

        // Upload image to IPFS
        const imageHash = await uploadToIPFS(file);
        const imageUrl = `ipfs://${imageHash}`;

        // Create metadata
        const metadata = {
          name,
          description,
          image: imageUrl,
          attributes,
          external_url: 'https://quanta-marketplace.com',
        };

        // Upload metadata to IPFS
        const metadataBlob = new Blob([JSON.stringify(metadata)], { type: 'application/json' });
        const metadataFile = new File([metadataBlob], 'metadata.json', { type: 'application/json' });
        const metadataHash = await uploadToIPFS(metadataFile);
        const tokenURI = `ipfs://${metadataHash}`;

        tokenURIs.push(tokenURI);
      }

      // Calculate total fees
      const totalFees = stats!.mintingFee * BigInt(batchForm.files.length);
      if (totalFees <= 0n) {
        toast.error('Invalid minting fee. Please check the collection settings.');
        return;
      }

      if (!address) {
        toast.error('Please connect your wallet');
        return;
      }
      // Batch mint NFTs
      await writeContract({
        address: CONTRACT_ADDRESSES.NFT_COLLECTION,
        abi: NFT_COLLECTION_ABI,
        functionName: 'batchMintNFT',
        args: [address, tokenURIs],
      });

      toast.success(`Successfully minted ${batchForm.files.length} NFTs!`);
      setShowBatchMint(false);
      setBatchForm({ files: [], names: [], descriptions: [], attributes: [] });

      // Refresh stats
      setTimeout(() => {
        loadStats();
      }, 2000);
    } catch (error: any) {
      console.error('Batch mint error:', error);
      toast.error(error.message || 'Failed to batch mint NFTs');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateMintingFee = async () => {
    if (!isConnected || !newMintingFee) return;

    try {
      await writeContract({
        address: CONTRACT_ADDRESSES.NFT_COLLECTION,
        abi: NFT_COLLECTION_ABI,
        functionName: 'setMintingFee',
        args: [parseQTA(newMintingFee)],
      });

      toast.success('Minting fee updated successfully!');
      setNewMintingFee('');
      setShowSettings(false);

      setTimeout(() => {
        loadStats();
      }, 2000);
    } catch (error: any) {
      console.error('Update fee error:', error);
      toast.error(error.message || 'Failed to update minting fee');
    }
  };

  const handleUpdateMaxMints = async () => {
    if (!isConnected || !newMaxMints) return;

    try {
      await writeContract({
        address: CONTRACT_ADDRESSES.NFT_COLLECTION,
        abi: NFT_COLLECTION_ABI,
        functionName: 'setMaxMintsPerAddress',
        args: [BigInt(newMaxMints)],
      });

      toast.success('Max mints per address updated successfully!');
      setNewMaxMints('');
      setShowSettings(false);

      setTimeout(() => {
        loadStats();
      }, 2000);
    } catch (error: any) {
      console.error('Update max mints error:', error);
      toast.error(error.message || 'Failed to update max mints');
    }
  };

  const handleWithdrawFees = async () => {
    if (!isConnected || !address) return;

    try {
      await writeContract({
        address: CONTRACT_ADDRESSES.NFT_COLLECTION,
        abi: NFT_COLLECTION_ABI,
        functionName: 'withdrawMintingFees',
        args: [address],
      });

      toast.success('Minting fees withdrawn successfully!');

      setTimeout(() => {
        loadStats();
      }, 2000);
    } catch (error: any) {
      console.error('Withdraw fees error:', error);
      toast.error(error.message || 'Failed to withdraw fees');
    }
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    setBatchForm(prev => ({
      ...prev,
      files,
      names: files.map((_, i) => prev.names[i] || ''),
      descriptions: files.map((_, i) => prev.descriptions[i] || ''),
      attributes: files.map((_, i) => prev.attributes[i] || []),
    }));
  };

  useEffect(() => {
    loadStats();
  }, [publicClient]);

  if (!isConnected) {
    return (
      <div className="max-w-md mx-auto text-center py-12">
        <div className="bg-gradient-to-br from-slate-800 via-slate-900 to-gray-900 rounded-2xl p-8 shadow-2xl border border-slate-700/50 backdrop-blur-sm">
          <div className="w-16 h-16 bg-gradient-to-r from-violet-600 to-indigo-600 rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg shadow-violet-500/25">
            <Upload className="w-8 h-8 text-white" />
          </div>
          <h2 className="text-xl font-semibold bg-gradient-to-r from-white to-gray-300 bg-clip-text text-transparent mb-2">Connect Your Wallet</h2>
          <p className="text-slate-400">
            Please connect your wallet to start minting NFTs
          </p>
        </div>
      </div>
    );
  }

  // Check if user is authorized to access this page
  if (!isAuthorized) {
    return (
      <div className="text-center py-12">
        <div className="max-w-md mx-auto bg-gray-800 rounded-xl p-8 shadow-lg border border-gray-700">
          <div className="w-16 h-16 bg-red-600 rounded-full flex items-center justify-center mx-auto mb-4">
            <Settings className="w-8 h-8 text-white" />
          </div>
          <h2 className="text-xl font-semibold text-white mb-2">Access Denied</h2>
          <p className="text-gray-400 mb-4">
            You are not authorized to access the NFT Collection Manager.
          </p>
          <p className="text-sm text-gray-500">
            Only the contract owner or authorized addresses can manage the collection.
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
          <h1 className="text-3xl font-bold text-white mb-2">NFT Collection Manager</h1>
          <p className="text-slate-400">
            Manage your NFT collection, batch mint, and configure settings
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowBatchMint(true)}
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-violet-600 to-indigo-600 text-white rounded-lg hover:from-violet-700 hover:to-indigo-700"
          >
            <Upload className="w-4 h-4" />
            Batch Mint
          </button>
          <button
            onClick={() => setShowSettings(true)}
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-slate-600 to-slate-700 text-white rounded-lg hover:from-slate-700 hover:to-slate-800"
          >
            <Settings className="w-4 h-4" />
            Settings
          </button>
          <button
            onClick={loadStats}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-slate-600 text-white rounded-lg hover:bg-slate-700 disabled:opacity-50"
          >
            {loading ? (
              <LoadingSpinner size="sm" />
            ) : (
              <BarChart3 className="w-4 h-4" />
            )}
            Refresh
          </button>
        </div>
      </div>

      {/* Statistics */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <LoadingSpinner size="lg" />
        </div>
      ) : stats ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-slate-800 rounded-xl shadow-md p-6 border border-slate-700">
            <div className="flex items-center">
              <div className="p-2 bg-violet-600 rounded-lg">
                <Package className="w-6 h-6 text-white" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-slate-400">Total Minted</p>
                <p className="text-2xl font-bold text-white">{Number(stats.totalMinted)}</p>
              </div>
            </div>
          </div>

          <div className="bg-slate-800 rounded-xl shadow-md p-6 border border-slate-700">
            <div className="flex items-center">
              <div className="p-2 bg-emerald-600 rounded-lg">
                <DollarSign className="w-6 h-6 text-white" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-slate-400">Minting Fee</p>
                <p className="text-2xl font-bold text-white">{formatQTA(stats.mintingFee)} QTA</p>
              </div>
            </div>
          </div>

          <div className="bg-slate-800 rounded-xl shadow-md p-6 border border-slate-700">
            <div className="flex items-center">
              <div className="p-2 bg-indigo-600 rounded-lg">
                <Users className="w-6 h-6 text-white" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-slate-400">Max Per Address</p>
                <p className="text-2xl font-bold text-white">
                  {Number(stats.maxMintsPerAddress) === 0 ? 'Unlimited' : Number(stats.maxMintsPerAddress)}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-slate-800 rounded-xl shadow-md p-6 border border-slate-700">
            <div className="flex items-center">
              <div className="p-2 bg-amber-600 rounded-lg">
                <DollarSign className="w-6 h-6 text-white" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-slate-400">Accumulated Fees</p>
                <p className="text-2xl font-bold text-white">{formatQTA(stats.accumulatedFees)} QTA</p>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {/* Withdraw Fees Button */}
      {stats && stats.accumulatedFees > 0n && (
        <div className="mb-8">
          <button
            onClick={handleWithdrawFees}
            className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-amber-600 to-orange-600 text-white rounded-lg hover:from-amber-700 hover:to-orange-700"
          >
            <DollarSign className="w-5 h-5" />
            Withdraw {formatQTA(stats.accumulatedFees)} QTA in Fees
          </button>
        </div>
      )}

      {/* Batch Mint Modal */}
      {showBatchMint && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Batch Mint NFTs</h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Upload Images (Max 20)
                </label>
                <input
                  type="file"
                  multiple
                  accept="image/*"
                  onChange={handleFileChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <p className="text-sm text-gray-500 mt-1">
                  Total cost: {batchForm.files.length > 0 ? formatQTA(stats!.mintingFee * BigInt(batchForm.files.length)) : '0'} QTA
                </p>
              </div>

              {batchForm.files.length > 0 && (
                <div className="space-y-4">
                  {batchForm.files.map((file, index) => (
                    <div key={index} className="border border-gray-200 rounded-lg p-4">
                      <div className="flex items-center gap-4 mb-3">
                        <img
                          src={URL.createObjectURL(file)}
                          alt={`Preview ${index + 1}`}
                          className="w-16 h-16 object-cover rounded-lg"
                        />
                        <div className="flex-1">
                          <input
                            type="text"
                            placeholder="NFT Name"
                            value={batchForm.names[index] || ''}
                            onChange={(e) => {
                              const newNames = [...batchForm.names];
                              newNames[index] = e.target.value;
                              setBatchForm(prev => ({ ...prev, names: newNames }));
                            }}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent mb-2"
                          />
                          <textarea
                            placeholder="Description (optional)"
                            value={batchForm.descriptions[index] || ''}
                            onChange={(e) => {
                              const newDescriptions = [...batchForm.descriptions];
                              newDescriptions[index] = e.target.value;
                              setBatchForm(prev => ({ ...prev, descriptions: newDescriptions }));
                            }}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            rows={2}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => {
                  setShowBatchMint(false);
                  setBatchForm({ files: [], names: [], descriptions: [], attributes: [] });
                }}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleBatchMint}
                disabled={batchForm.files.length === 0 || loading}
                className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <>
                    <LoadingSpinner size="sm" />
                    Minting...
                  </>
                ) : (
                  `Mint ${batchForm.files.length} NFTs`
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Settings Modal */}
      {showSettings && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Collection Settings</h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  New Minting Fee (QTA)
                </label>
                <input
                  type="number"
                  value={newMintingFee}
                  onChange={(e) => setNewMintingFee(e.target.value)}
                  step="0.01"
                  min="0"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Enter new fee"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Max Mints Per Address (0 = unlimited)
                </label>
                <input
                  type="number"
                  value={newMaxMints}
                  onChange={(e) => setNewMaxMints(e.target.value)}
                  min="0"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Enter limit"
                />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => {
                  setShowSettings(false);
                  setNewMintingFee('');
                  setNewMaxMints('');
                }}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <div className="flex-1 space-y-2">
                {newMintingFee && (
                  <button
                    onClick={handleUpdateMintingFee}
                    className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                  >
                    Update Fee
                  </button>
                )}
                {newMaxMints && (
                  <button
                    onClick={handleUpdateMaxMints}
                    className="w-full px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
                  >
                    Update Limit
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
} 