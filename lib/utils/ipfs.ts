import axios from 'axios';

const PINATA_JWT = process.env.NEXT_PUBLIC_PINATA_JWT;
const GATEWAY_URL = process.env.NEXT_PUBLIC_GATEWAY_URL;



interface PinataResponse {
  IpfsHash: string;
  PinSize: number;
  Timestamp: string;
}

interface NFTMetadata {
  name: string;
  description: string;
  image: string;
  attributes?: Array<{
    trait_type: string;
    value: string | number;
  }>;
}

export async function uploadToIPFS(file: File): Promise<string> {
  if (!PINATA_JWT) {
    throw new Error('Pinata JWT not configured');
  }

  const formData = new FormData();
  formData.append('file', file);

  const metadata = JSON.stringify({
    name: file.name,
    keyvalues: {
      type: 'nft-image',
      timestamp: Date.now().toString(),
    },
  });
  formData.append('pinataMetadata', metadata);

  const options = JSON.stringify({
    cidVersion: 0,
  });
  formData.append('pinataOptions', options);

  try {
    const response = await axios.post<PinataResponse>(
      'https://api.pinata.cloud/pinning/pinFileToIPFS',
      formData,
      {
        maxBodyLength: Infinity,
        headers: {
          'Content-Type': 'multipart/form-data',
          Authorization: `Bearer ${PINATA_JWT}`,
        },
      }
    );

    return response.data.IpfsHash;
  } catch (error) {
    console.error('Error uploading to IPFS:', error);
    throw new Error('Failed to upload image to IPFS');
  }
}

export async function uploadMetadataToIPFS(metadata: NFTMetadata): Promise<string> {
  if (!PINATA_JWT) {
    throw new Error('Pinata JWT not configured');
  }

  try {
    const response = await axios.post<PinataResponse>(
      'https://api.pinata.cloud/pinning/pinJSONToIPFS',
      metadata,
      {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${PINATA_JWT}`,
        },
      }
    );

    return response.data.IpfsHash;
  } catch (error) {
    console.error('Error uploading metadata to IPFS:', error);
    throw new Error('Failed to upload metadata to IPFS');
  }
}

export function getIPFSUrl(hash: string): string {
  return `${GATEWAY_URL}${hash}`;
}

export async function fetchMetadataFromIPFS(tokenURI: string): Promise<NFTMetadata> {
  try {
    // Handle both direct IPFS URLs and tokenURI formats
    let url = tokenURI;
    if (tokenURI.startsWith('ipfs://')) {
      url = tokenURI.replace('ipfs://', GATEWAY_URL || 'https://gateway.pinata.cloud/ipfs/');
    } else if (!tokenURI.startsWith('http')) {
      url = `${GATEWAY_URL}${tokenURI}`;
    }

    const response = await axios.get<NFTMetadata>(url);
    return response.data;
  } catch (error) {
    console.error('Error fetching metadata from IPFS:', error);
    throw new Error('Failed to fetch NFT metadata');
  }
}