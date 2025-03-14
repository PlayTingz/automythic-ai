import * as anchor from '@coral-xyz/anchor';
import { PublicKey, Keypair, Connection } from '@solana/web3.js';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Load IDL
const idlPath = path.resolve('./target/idl/shop.json');
const idl = JSON.parse(fs.readFileSync(idlPath, 'utf8'));

// Get program ID from IDL
const programId = new PublicKey(idl.address);
console.log('Using program ID:', programId.toString());

// Get network from command line args or environment
const network = process.argv[2] === 'mainnet' ? 'mainnet' :
  process.argv[2] === 'helius' ? 'helius' : 'testnet';

// Setup connection to Sonic network
let rpcUrl;
switch (network) {
  case 'mainnet':
    rpcUrl = process.env.SONIC_MAINNET_RPC_URL || 'https://api.mainnet-alpha.sonic.game';
    console.log('Using Sonic Mainnet Alpha');
    break;
  case 'helius':
    rpcUrl = process.env.SONIC_HELIUS_RPC_URL || 'https://sonic.helius-rpc.com/';
    console.log('Using Sonic Helius RPC');
    break;
  default:
    rpcUrl = process.env.SONIC_TESTNET_RPC_URL || 'https://api.testnet.sonic.game';
    console.log('Using Sonic Testnet');
    break;
}

const connection = new Connection(rpcUrl, 'confirmed');

// Load wallet from keypair file
const walletPath = process.env.WALLET_PATH || path.resolve('./wallets/admin.json');
const walletKeypair = Keypair.fromSecretKey(
  new Uint8Array(JSON.parse(fs.readFileSync(walletPath, 'utf8')))
);
const wallet = new anchor.Wallet(walletKeypair);

// Create provider and program
const provider = new anchor.AnchorProvider(connection, wallet, {
  preflightCommitment: 'confirmed',
});
anchor.setProvider(provider);

// Helper function to derive item PDA
const getItemPDA = (id) => {
  const idBuffer = Buffer.alloc(8);
  idBuffer.writeBigUInt64LE(BigInt(id));

  const [itemPDA] = PublicKey.findProgramAddressSync(
    [Buffer.from('item'), idBuffer],
    programId
  );
  return itemPDA;
};

// Get item details from account data
async function getItemDetails(itemPDA) {
  try {
    const accountInfo = await connection.getAccountInfo(itemPDA);
    if (!accountInfo || !accountInfo.data) {
      return null;
    }

    // Skip the 8-byte discriminator
    let offset = 8;

    // Read the item ID (8 bytes for u64)
    const itemId = Number(accountInfo.data.readBigUInt64LE(offset));
    offset += 8;

    // Read the price (8 bytes for u64)
    const price = Number(accountInfo.data.readBigUInt64LE(offset));
    offset += 8;

    // Read the metadata URI length (4 bytes)
    const metadataUriLength = accountInfo.data.readUInt32LE(offset);
    offset += 4;

    // Read the metadata URI
    const metadataUri = accountInfo.data.slice(offset, offset + metadataUriLength).toString('utf8');

    return {
      id: itemId,
      price,
      metadataUri
    };
  } catch (error) {
    console.warn('Could not parse item metadata:', error);
    return null;
  }
}

// Mark an item as inactive in the shop
// Note: Since we can't actually delete the account (it's a PDA), we'll update it to mark it as inactive
async function markItemInactive(id) {
  try {
    // Get PDAs
    const itemPDA = getItemPDA(id);

    console.log(`Marking item #${id} as inactive`);
    console.log('Item PDA:', itemPDA.toString());

    // Check if the item exists
    const accountInfo = await connection.getAccountInfo(itemPDA);
    if (!accountInfo) {
      console.log(`Item #${id} does not exist!`);
      return null;
    }

    // Get item details
    const itemDetails = await getItemDetails(itemPDA);
    if (itemDetails) {
      console.log('Item details:');
      console.log(`  ID: ${itemDetails.id}`);
      console.log(`  Price: ${itemDetails.price} lamports (${itemDetails.price / 1000000000} SOL)`);
      console.log(`  Metadata URI: ${itemDetails.metadataUri}`);

      // If this is a simplified metadata format (image:URL), extract the URL
      if (itemDetails.metadataUri.startsWith('image:')) {
        const imageUrl = itemDetails.metadataUri.substring(6); // Remove 'image:' prefix
        console.log(`  Image URL: ${imageUrl}`);
        console.log('Note: IPFS content cannot be deleted once uploaded. The image URL will remain accessible.');
      }
    }

    console.log('\nImportant: In Solana, PDA accounts cannot be deleted directly.');
    console.log('To "delete" an item, you would need to:');
    console.log('1. Add a "delete_item" or "mark_inactive" instruction to your contract');
    console.log('2. Update the shop page to filter out inactive items');
    console.log('\nAlternatively, you can stop displaying this item in your frontend.');

    return itemPDA;
  } catch (error) {
    console.error('Error marking item as inactive:', error);
    throw error;
  }
}

// Main function
async function main() {
  if (process.argv.length < 4) {
    console.log('Usage: node delete-item.js [network] [item-id]');
    console.log('Example: node delete-item.js testnet 2');
    process.exit(1);
  }

  const itemId = parseInt(process.argv[3]);

  if (isNaN(itemId)) {
    console.error('Item ID must be a number');
    process.exit(1);
  }

  try {
    await markItemInactive(itemId);
  } catch (error) {
    console.error('Failed to process item:', error);
    process.exit(1);
  }
}

// Run the main function
main(); 