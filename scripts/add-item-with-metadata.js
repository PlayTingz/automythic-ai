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

// Helper function to derive PDAs
const getShopPDA = () => {
  const [shopPDA] = PublicKey.findProgramAddressSync(
    [Buffer.from('shop')],
    programId
  );
  return shopPDA;
};

const getItemPDA = (id) => {
  const idBuffer = Buffer.alloc(8);
  idBuffer.writeBigUInt64LE(BigInt(id));

  const [itemPDA] = PublicKey.findProgramAddressSync(
    [Buffer.from('item'), idBuffer],
    programId
  );
  return itemPDA;
};

// Add item with metadata
async function addItemWithMetadata(metadataPath) {
  try {
    // Read metadata file
    const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));

    // Extract item details
    const { id, price, name, image_url } = metadata;

    if (!id || !price) {
      console.error('Metadata must include id and price');
      return null;
    }

    console.log(`Adding item #${id}: ${name || 'Unnamed Item'}`);
    console.log(`Price: ${price / 1_000_000_000} SOL`);

    // Create a simplified metadata URI that just references the image URL
    // This is to avoid the metadata being too large for the account
    const simplifiedMetadata = `image:${image_url || ''}`;

    // Get PDAs
    const shopPDA = getShopPDA();
    const itemPDA = getItemPDA(id);

    console.log('Shop PDA:', shopPDA.toString());
    console.log('Item PDA:', itemPDA.toString());

    // Check if the item already exists
    const existingItem = await connection.getAccountInfo(itemPDA);
    if (existingItem !== null) {
      console.log(`Item #${id} already exists!`);
      return itemPDA;
    }

    // Create transaction
    const transaction = new anchor.web3.Transaction();

    // Add compute budget instruction to increase units
    const ix = await anchor.web3.ComputeBudgetProgram.setComputeUnitLimit({
      units: 1000000
    });
    transaction.add(ix);

    // Prepare the instruction data for add_item
    // Discriminator for add_item (first 8 bytes of the hash of "global:add_item")
    const discriminator = Buffer.from([225, 38, 79, 147, 116, 142, 147, 57]);

    // Encode the id (u64)
    const idBuffer = Buffer.alloc(8);
    idBuffer.writeBigUInt64LE(BigInt(id));

    // Encode the price (u64)
    const priceBuffer = Buffer.alloc(8);
    priceBuffer.writeBigUInt64LE(BigInt(price));

    // Encode the metadata_uri (string)
    const metadataUriBuffer = Buffer.from(simplifiedMetadata);
    const metadataUriLengthBuffer = Buffer.alloc(4);
    metadataUriLengthBuffer.writeUInt32LE(metadataUriBuffer.length);

    // Combine all buffers
    const data = Buffer.concat([
      discriminator,
      idBuffer,
      priceBuffer,
      metadataUriLengthBuffer,
      metadataUriBuffer
    ]);

    // Add the add_item instruction
    transaction.add(
      new anchor.web3.TransactionInstruction({
        keys: [
          { pubkey: wallet.publicKey, isSigner: true, isWritable: true },
          { pubkey: shopPDA, isSigner: false, isWritable: true },
          { pubkey: itemPDA, isSigner: false, isWritable: true },
          { pubkey: anchor.web3.SystemProgram.programId, isSigner: false, isWritable: false }
        ],
        programId,
        data
      })
    );

    // Sign and send the transaction
    const tx = await anchor.web3.sendAndConfirmTransaction(
      connection,
      transaction,
      [wallet.payer]
    );

    console.log('Item added successfully!');
    console.log('Transaction signature:', tx);

    // Show explorer link
    const explorerUrl = process.env.SONIC_EXPLORER_URL || 'https://explorer.sonic.game';
    console.log(`View transaction: ${explorerUrl}/tx/${tx}`);

    return itemPDA;
  } catch (error) {
    console.error('Error adding item:', error);
    throw error;
  }
}

// Main function
async function main() {
  if (process.argv.length < 4) {
    console.log('Usage: node add-item-with-metadata.js [network] [metadata-file-path]');
    console.log('Example: node add-item-with-metadata.js testnet examples/item-metadata.json');
    process.exit(1);
  }

  const metadataPath = process.argv[3];

  try {
    await addItemWithMetadata(metadataPath);
  } catch (error) {
    console.error('Failed to add item:', error);
    process.exit(1);
  }
}

// Run the main function
main(); 