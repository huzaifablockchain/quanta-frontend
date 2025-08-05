'use client';

import { useState } from 'react';
import Image from 'next/image';
import { useAccount, useWriteContract, useWaitForTransactionReceipt, useReadContract } from 'wagmi';
import { Upload, Image as ImageIcon, Loader2, CheckCircle, AlertCircle } from 'lucide-react';
import { uploadToIPFS, uploadMetadataToIPFS, getIPFSUrl } from '@/lib/utils/ipfs';
import { useQTABalance } from '@/hooks/useQTABalance';
import { useQTAApproval } from '@/hooks/useApproval';
import { CONTRACT_ADDRESSES, NFT_COLLECTION_ABI, QTA_TOKEN_ABI } from '@/lib/config/contracts';
import { formatQTA, parseQTA } from '@/lib/utils/format';
import { LoadingSpinner } from './ui/LoadingSpinner';
import toast from 'react-hot-toast';

interface MintFormData {
  name: string;
  description: string;
  file: File | null;
  attributes: Array<{ trait_type: string; value: string }>;
}

export function MintPage() {
  const { address, isConnected } = useAccount();
  const { balance } = useQTABalance();
  const { approveQTA, isApproved, isApproving } = useQTAApproval();
  
  // Check if NFT collection is approved to spend QTA tokens
  const { data: qtaAllowance } = useReadContract({
    address: CONTRACT_ADDRESSES.QTA_TOKEN,
    abi: QTA_TOKEN_ABI,
    functionName: 'allowance',
    args: address ? [address, CONTRACT_ADDRESSES.NFT_COLLECTION] : undefined,
    query: {
      enabled: !!address,
    },
  });
  
  const [formData, setFormData] = useState<MintFormData>({
    name: '',
    description: '',
    file: null,
    attributes: [{ trait_type: '', value: '' }],
  });
  
  const [preview, setPreview] = useState<string | null>(null);
  const [step, setStep] = useState<'form' | 'uploading' | 'minting' | 'success'>('form');
  const [progress, setProgress] = useState('');
  const [mintedTokenId, setMintedTokenId] = useState<number | null>(null);

  const { writeContract, data: hash, isPending, error: writeError } = useWriteContract();
  const { isLoading: isMinting, isSuccess, error: transactionError } = useWaitForTransactionReceipt({
    hash,
  });

  // Get minting fee
  const { data: mintingFee } = useReadContract({
    address: CONTRACT_ADDRESSES.NFT_COLLECTION,
    abi: NFT_COLLECTION_ABI,
    functionName: 'mintingFee',
  });

  const mintingFeeFormatted = mintingFee ? formatQTA(mintingFee) : '0';
  const hasEnoughBalance = balance >= (mintingFee || 0n);
  const needsApproval = !isApproved(mintingFeeFormatted);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 10 * 1024 * 1024) { // 10MB limit
        toast.error('File size must be less than 10MB');
        return;
      }
      
      if (!file.type.startsWith('image/')) {
        toast.error('Please select an image file');
        return;
      }

      setFormData(prev => ({ ...prev, file }));
      
      const reader = new FileReader();
      reader.onload = (e) => setPreview(e.target?.result as string);
      reader.readAsDataURL(file);
    }
  };

  const addAttribute = () => {
    setFormData(prev => ({
      ...prev,
      attributes: [...prev.attributes, { trait_type: '', value: '' }],
    }));
  };

  const removeAttribute = (index: number) => {
    setFormData(prev => ({
      ...prev,
      attributes: prev.attributes.filter((_, i) => i !== index),
    }));
  };

  const updateAttribute = (index: number, field: 'trait_type' | 'value', value: string) => {
    setFormData(prev => ({
      ...prev,
      attributes: prev.attributes.map((attr, i) => 
        i === index ? { ...attr, [field]: value } : attr
      ),
    }));
  };

  const handleMint = async () => {
    if (!isConnected || !address) {
      toast.error('Please connect your wallet');
      return;
    }

    if (!formData.file || !formData.name.trim()) {
      toast.error('Please fill in all required fields');
      return;
    }

    if (!hasEnoughBalance) {
      toast.error('Insufficient QTA balance for minting');
      return;
    }

    if (needsApproval) {
      setProgress('Approving QTA tokens...');
      const approved = await approveQTA(mintingFeeFormatted);
      if (!approved) return;
    }

    // Check if NFT collection needs approval to spend QTA tokens
    const hasQTAApproval = qtaAllowance && qtaAllowance >= (mintingFee || 0n);
    if (!hasQTAApproval) {
      setProgress('Approving QTA tokens for NFT collection...');
      try {
        await writeContract({
          address: CONTRACT_ADDRESSES.QTA_TOKEN,
          abi: QTA_TOKEN_ABI,
          functionName: 'approve',
          args: [CONTRACT_ADDRESSES.NFT_COLLECTION, mintingFee || 0n],
        });
        toast.success('QTA tokens approved for NFT collection!');
      } catch (error: any) {
        console.error('QTA approval error:', error);
        toast.error('Failed to approve QTA tokens for NFT collection');
        return;
      }
    }

    try {
      setStep('uploading');
      setProgress('Uploading image to IPFS...');
      
      // Upload image to IPFS
      const imageHash = await uploadToIPFS(formData.file);
      const imageUrl = `ipfs://${imageHash}`;
      
      setProgress('Uploading metadata to IPFS...');
      
      // Create metadata
      const metadata = {
        name: formData.name,
        description: formData.description,
        image: imageUrl,
        attributes: formData.attributes.filter(attr => attr.trait_type && attr.value),
      };
      
      // Upload metadata to IPFS
      const metadataHash = await uploadMetadataToIPFS(metadata);
      const tokenURI = `ipfs://${metadataHash}`;
      
      setStep('minting');
      setProgress('Minting NFT...');
      
      // Mint NFT
      console.log('Minting NFT with:', {
        address: CONTRACT_ADDRESSES.NFT_COLLECTION,
        functionName: 'mintNFT',
        args: [address, tokenURI],
        userAddress: address,
        tokenURI: tokenURI,
      });
      
      writeContract({
        address: CONTRACT_ADDRESSES.NFT_COLLECTION,
        abi: NFT_COLLECTION_ABI,
        functionName: 'mintNFT',
        args: [address, tokenURI],
      });
      
    } catch (error: any) {
      console.error('Minting error:', error);
      console.error('Write error:', writeError);
      console.error('Transaction error:', transactionError);
      toast.error(error.message || 'Failed to mint NFT');
      setStep('form');
      setProgress('');
    }
  };

  // Handle successful minting
  if (isSuccess && step !== 'success') {
    setStep('success');
    toast.success('NFT minted successfully!');
    // Reset form
    setFormData({
      name: '',
      description: '',
      file: null,
      attributes: [{ trait_type: '', value: '' }],
    });
    setPreview(null);
  }

  // Handle transaction errors
  if (transactionError) {
    console.error('Transaction failed:', transactionError);
    toast.error(`Transaction failed: ${transactionError.message}`);
    setStep('form');
    setProgress('');
  }

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

  if (step === 'uploading' || step === 'minting') {
    return (
      <div className="max-w-md mx-auto text-center py-12">
        <div className="bg-gradient-to-br from-slate-800 via-slate-900 to-gray-900 rounded-2xl p-8 shadow-2xl border border-slate-700/50 backdrop-blur-sm">
          <LoadingSpinner size="lg" className="mx-auto mb-4" />
          <h2 className="text-xl font-semibold bg-gradient-to-r from-white to-gray-300 bg-clip-text text-transparent mb-2">
            {step === 'uploading' ? 'Uploading to IPFS' : 'Minting NFT'}
          </h2>
          <p className="text-slate-400">{progress}</p>
        </div>
      </div>
    );
  }

  if (step === 'success') {
    return (
      <div className="max-w-md mx-auto text-center py-12">
        <div className="bg-gradient-to-br from-slate-800 via-slate-900 to-gray-900 rounded-2xl p-8 shadow-2xl border border-slate-700/50 backdrop-blur-sm">
          <div className="w-16 h-16 bg-gradient-to-r from-emerald-500 to-green-600 rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg shadow-emerald-500/25">
            <CheckCircle className="w-8 h-8 text-white" />
          </div>
          <h2 className="text-xl font-semibold bg-gradient-to-r from-white to-gray-300 bg-clip-text text-transparent mb-2">NFT Minted Successfully!</h2>
          <p className="text-slate-400 mb-6">
            Your NFT has been created and added to your collection
          </p>
          <button
            onClick={() => setStep('form')}
            className="w-full bg-gradient-to-r from-violet-600 to-indigo-600 text-white py-3 px-4 rounded-xl hover:from-violet-700 hover:to-indigo-700 transition-all duration-200 shadow-lg shadow-violet-500/25 font-medium"
          >
            Mint Another NFT
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="bg-gradient-to-br from-slate-800 via-slate-900 to-gray-900 rounded-2xl shadow-2xl overflow-hidden border border-slate-700/50 backdrop-blur-sm">
        <div className="p-6 border-b border-slate-700/50 bg-gradient-to-r from-slate-800/50 to-slate-900/50">
          <h1 className="text-2xl font-bold bg-gradient-to-r from-white via-slate-200 to-gray-300 bg-clip-text text-transparent">Mint New NFT</h1>
          <p className="text-slate-400 mt-2">
            Create your unique NFT with custom metadata and attributes
          </p>
        </div>

        <div className="p-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Upload Section */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-3">
                Upload Image *
              </label>
              
              {preview ? (
                <div className="relative group">
                  <div className="aspect-square rounded-xl overflow-hidden bg-gradient-to-br from-slate-700 to-slate-800 shadow-xl">
                    <Image
                      src={preview}
                      alt="Preview"
                      fill
                      className="object-cover"
                    />
                  </div>
                  <button
                    onClick={() => {
                      setPreview(null);
                      setFormData(prev => ({ ...prev, file: null }));
                    }}
                    className="absolute top-3 right-3 bg-red-500 text-white rounded-full w-8 h-8 flex items-center justify-center hover:bg-red-600 transition-colors shadow-lg opacity-0 group-hover:opacity-100"
                  >
                    ×
                  </button>
                </div>
              ) : (
                <label className="aspect-square border-2 border-dashed border-slate-600 rounded-xl flex flex-col items-center justify-center cursor-pointer hover:border-violet-400 hover:bg-slate-800/50 transition-all duration-200 bg-gradient-to-br from-slate-800/20 to-slate-900/20">
                  <ImageIcon className="w-12 h-12 text-slate-400 mb-2" />
                  <p className="text-slate-400 text-center px-4">
                    Drop your image here or click to browse
                  </p>
                  <p className="text-xs text-slate-500 mt-1">
                    PNG, JPG, GIF up to 10MB
                  </p>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                </label>
              )}
            </div>

            {/* Form Section */}
            <div className="space-y-6">
              {/* Basic Info */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">
                  Name *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full px-4 py-3 bg-gradient-to-r from-slate-700 to-slate-800 border border-slate-600 rounded-xl text-white placeholder-slate-400 focus:ring-2 focus:ring-violet-500 focus:border-transparent transition-all duration-200 shadow-inner"
                  placeholder="Enter NFT name"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">
                  Description
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  rows={3}
                  className="w-full px-4 py-3 bg-gradient-to-r from-slate-700 to-slate-800 border border-slate-600 rounded-xl text-white placeholder-slate-400 focus:ring-2 focus:ring-violet-500 focus:border-transparent transition-all duration-200 shadow-inner resize-none"
                  placeholder="Describe your NFT"
                />
              </div>

              {/* Attributes */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <label className="block text-sm font-medium text-slate-300">
                    Attributes
                  </label>
                  <button
                    onClick={addAttribute}
                    className="text-sm text-violet-400 hover:text-violet-300 transition-colors font-medium"
                  >
                    + Add Attribute
                  </button>
                </div>
                
                <div className="space-y-3">
                  {formData.attributes.map((attr, index) => (
                    <div key={index} className="flex gap-2 items-stretch">
                      <input
                        type="text"
                        value={attr.trait_type}
                        onChange={(e) => updateAttribute(index, 'trait_type', e.target.value)}
                        placeholder="Trait type"
                        className="flex-1 min-w-0 px-3 py-2 bg-gradient-to-r from-slate-700 to-slate-800 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:ring-2 focus:ring-violet-500 focus:border-transparent text-sm transition-all duration-200 shadow-inner overflow-hidden"
                      />
                      <input
                        type="text"
                        value={attr.value}
                        onChange={(e) => updateAttribute(index, 'value', e.target.value)}
                        placeholder="Value"
                        className="flex-1 min-w-0 px-3 py-2 bg-gradient-to-r from-slate-700 to-slate-800 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:ring-2 focus:ring-violet-500 focus:border-transparent text-sm transition-all duration-200 shadow-inner overflow-hidden"
                      />
                      {formData.attributes.length > 1 && (
                        <button
                          onClick={() => removeAttribute(index)}
                          className="w-8 h-8 flex items-center justify-center text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-lg transition-colors flex-shrink-0"
                        >
                          ×
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Minting Info */}
              <div className="bg-gradient-to-r from-slate-700/50 to-slate-800/50 rounded-xl p-4 border border-slate-600/50">
                <h3 className="font-medium text-white mb-3">Minting Information</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Minting Fee:</span>
                    <span className="font-medium text-white">{mintingFeeFormatted} QTA</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Your Balance:</span>
                    <span className={`font-medium ${hasEnoughBalance ? 'text-emerald-400' : 'text-red-400'}`}>
                      {formatQTA(balance)} QTA
                    </span>
                  </div>
                </div>
                
                {!hasEnoughBalance && (
                  <div className="mt-3 flex items-center text-red-400 text-sm bg-red-500/10 p-2 rounded-lg">
                    <AlertCircle className="w-4 h-4 mr-2" />
                    Insufficient QTA balance
                  </div>
                )}
              </div>

              {/* Approval & Mint Button */}
              <div className="space-y-3">
                {needsApproval && hasEnoughBalance && (
                  <button
                    onClick={() => approveQTA(mintingFeeFormatted)}
                    disabled={isApproving}
                    className="w-full bg-gradient-to-r from-amber-500 to-orange-600 text-white py-3 px-4 rounded-xl hover:from-amber-600 hover:to-orange-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium flex items-center justify-center transition-all duration-200 shadow-lg shadow-amber-500/25"
                  >
                    {isApproving ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Approving QTA...
                      </>
                    ) : (
                      'Approve QTA'
                    )}
                  </button>
                )}
                
                <button
                  onClick={handleMint}
                  disabled={
                    isPending || 
                    isMinting || 
                    !formData.file || 
                    !formData.name.trim() || 
                    !hasEnoughBalance || 
                    needsApproval
                  }
                  className="w-full bg-gradient-to-r from-violet-600 to-indigo-600 text-white py-3 px-4 rounded-xl hover:from-violet-700 hover:to-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium flex items-center justify-center transition-all duration-200 shadow-lg shadow-violet-500/25"
                >
                  {isPending || isMinting ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      {isPending ? 'Confirm in Wallet...' : 'Minting...'}
                    </>
                  ) : (
                    'Mint NFT'
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}