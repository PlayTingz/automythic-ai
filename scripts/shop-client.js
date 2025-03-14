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

// Initialize shop
async function initializeShop() {
  try {
    const shopPDA = getShopPDA();
    console.log('Shop PDA:', shopPDA.toString());

    // Check if the shop account already exists
    const shopAccount = await connection.getAccountInfo(shopPDA);
    if (shopAccount !== null) {
      console.log('Shop is already initialized!');
      return shopPDA;
    }

    console.log('Initializing shop...');

    // Create the instruction data for initialize_shop
    const ix = await anchor.web3.ComputeBudgetProgram.setComputeUnitLimit({
      units: 1000000
    });

    // Create the transaction
    const transaction = new anchor.web3.Transaction().add(ix);

    // Add the initialize_shop instruction
    transaction.add(
      new anchor.web3.TransactionInstruction({
        keys: [
          { pubkey: wallet.publicKey, isSigner: true, isWritable: true },
          { pubkey: shopPDA, isSigner: false, isWritable: true },
          { pubkey: anchor.web3.SystemProgram.programId, isSigner: false, isWritable: false }
        ],
        programId,
        data: Buffer.from([76, 158, 246, 22, 47, 236, 107, 186]) // initialize_shop discriminator
      })
    );

    // Sign and send the transaction
    const tx = await anchor.web3.sendAndConfirmTransaction(
      connection,
      transaction,
      [wallet.payer]
    );

    console.log('Shop initialized successfully!');
    console.log('Transaction signature:', tx);

    // Show explorer link
    const explorerUrl = process.env.SONIC_EXPLORER_URL || 'https://explorer.sonic.game';
    console.log(`View transaction: ${explorerUrl}/tx/${tx}`);

    return shopPDA;
  } catch (error) {
    console.error('Error initializing shop:', error);
    throw error;
  }
}

// Add item to shop
async function addItem(id, price, metadataUri) {
  try {
    const shopPDA = getShopPDA();
    const itemPDA = getItemPDA(id);

    console.log(`Adding item ${id} with price ${price} SOL...`);
    console.log('Shop PDA:', shopPDA.toString());
    console.log('Item PDA:', itemPDA.toString());
    console.log('Metadata URI:', metadataUri);

    // Create the instruction data for add_item
    const ix = await anchor.web3.ComputeBudgetProgram.setComputeUnitLimit({
      units: 1000000
    });

    // Create the transaction
    const transaction = new anchor.web3.Transaction().add(ix);

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
    const metadataUriBuffer = Buffer.from(metadataUri);
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

// Get item details
async function getItem(id) {
  try {
    const itemPDA = getItemPDA(id);
    console.log(`Getting details for item ${id}...`);
    console.log('Item PDA:', itemPDA.toString());

    // Fetch the account data
    const accountInfo = await connection.getAccountInfo(itemPDA);

    if (!accountInfo) {
      console.error(`Item ${id} not found`);
      return null;
    }

    // Parse the account data
    // Skip the 8-byte discriminator
    const data = accountInfo.data.slice(8);

    // Parse id (u64, 8 bytes)
    const itemId = data.readBigUInt64LE(0);

    // Parse price (u64, 8 bytes)
    const price = data.readBigUInt64LE(8);

    // Parse metadata_uri (string)
    const metadataUriLength = data.readUInt32LE(16);
    const metadataUri = data.slice(20, 20 + metadataUriLength).toString();

    const item = {
      id: Number(itemId),
      price: Number(price),
      metadataUri
    };

    console.log('Item details:');
    console.log(`  ID: ${item.id}`);
    console.log(`  Price: ${item.price} lamports (${item.price / 1000000000} SOL)`);
    console.log(`  Metadata URI: ${item.metadataUri}`);

    return item;
  } catch (error) {
    console.error('Error getting item:', error);
    throw error;
  }
}

// Command line interface
async function main() {
  // Remove network argument if present
  const args = process.argv.slice(2);
  // Skip network argument if present (already handled at the top of the file)
  if (['mainnet', 'testnet', 'helius'].includes(args[0])) {
    args.shift();
  }

  const command = args[0];

  switch (command) {
    case 'init':
      await initializeShop();
      break;

    case 'add-item':
      const id = parseInt(args[1]);
      const price = parseInt(args[2]); // in lamports
      const metadataUri = args[3];

      if (!id || !price || !metadataUri) {
        console.error('Usage: node shop-client.js [network] add-item <id> <price> <metadataUri>');
        console.error('Example: node shop-client.js testnet add-item 1 1000000000 "ipfs://your-metadata-cid"');
        process.exit(1);
      }

      await addItem(id, price, metadataUri);
      break;

    case 'get-item':
      const itemId = parseInt(args[1]);
      if (!itemId) {
        console.error('Usage: node shop-client.js [network] get-item <id>');
        console.error('Example: node shop-client.js testnet get-item 1');
        process.exit(1);
      }
      await getItem(itemId);
      break;

    default:
      console.log('Available commands:');
      console.log('  init - Initialize shop');
      console.log('  add-item <id> <price> <metadataUri> - Add item to shop');
      console.log('  get-item <id> - Get item details');
      console.log('\nYou can specify a network before the command:');
      console.log('  node shop-client.js testnet|mainnet|helius <command>');
      break;
  }
}

// Run main function directly
main().catch(console.error); 