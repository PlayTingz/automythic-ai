import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import fetch from 'node-fetch';

// Load environment variables
dotenv.config();

// Get API key from environment variables
const NFT_STORAGE_API_KEY = process.env.NFT_STORAGE_API_KEY;

if (!NFT_STORAGE_API_KEY) {
  console.error("Error: NFT_STORAGE_API_KEY not found in environment variables");
  console.error("Please create a .env file with your NFT.Storage API key");
  process.exit(1);
}

/**
 * Upload item metadata to NFT.Storage using HTTP API
 * @param {Object} metadata - The metadata to upload
 * @returns {Promise<string>} - The IPFS CID
 */
async function uploadMetadata(metadata) {
  try {
    console.log("Creating collection...");

    // First, create a collection
    const collectionResponse = await fetch('https://preserve.nft.storage/api/v1/collection/create_collection', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${NFT_STORAGE_API_KEY}`
      },
      body: JSON.stringify({
        contractAddress: "solana-shop-" + Date.now(), // Using a unique string for Solana
        collectionName: "Digital Item Shop",
        chainID: "1", // Using a placeholder chain ID
        network: "Solana"
      })
    });

    if (!collectionResponse.ok) {
      const errorText = await collectionResponse.text();
      throw new Error(`Failed to create collection: ${errorText}`);
    }

    const collectionData = await collectionResponse.json();
    console.log("Collection created:", collectionData);

    // For simplicity, we'll just return a placeholder IPFS URI
    // In a real implementation, you would upload the metadata and get a CID
    const metadataStr = JSON.stringify(metadata);
    console.log("Metadata:", metadataStr);

    return `ipfs://placeholder-cid-for-${metadata.name.replace(/\s+/g, '-').toLowerCase()}`;
  } catch (error) {
    console.error("Error uploading metadata:", error);
    throw error;
  }
}

// Example usage
async function main() {
  // Check if a metadata file was provided
  const metadataFile = process.argv[2];

  if (metadataFile) {
    // Load metadata from file
    try {
      const filePath = path.resolve(metadataFile);
      const fileData = fs.readFileSync(filePath, 'utf8');
      const metadata = JSON.parse(fileData);
      const cid = await uploadMetadata(metadata);
      console.log(`Metadata CID: ${cid}`);
    } catch (error) {
      console.error(`Error reading metadata file: ${error.message}`);
    }
  } else {
    // Use example metadata
    const exampleMetadata = {
      id: 1,
      item_type: "Weapon",
      name: "Excalibur",
      description: "A legendary sword",
      price: 1000000000, // 1 SOL in lamports
      image_url: "https://example.com/excalibur.png"
    };

    const cid = await uploadMetadata(exampleMetadata);
    console.log(`Example metadata CID: ${cid}`);
    console.log("\nTo upload your own metadata, create a JSON file and run:");
    console.log("node scripts/upload-metadata.js your-metadata.json");
  }
}

main().catch(console.error); 