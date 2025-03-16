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

// Load buyer wallet
const buyerWalletPath = process.argv[3] === 'buyer2'
  ? path.resolve('./wallets/buyer2.json')
  : path.resolve('./wallets/buyer.json');

console.log(`Using wallet: ${buyerWalletPath}`);

let buyerKeypair;

try {
  buyerKeypair = Keypair.fromSecretKey(
    new Uint8Array(JSON.parse(fs.readFileSync(buyerWalletPath, 'utf8')))
  );
} catch (err) {
  console.error(`Error loading buyer wallet: ${err.message}`);
  process.exit(1);
}

const buyerPublicKey = buyerKeypair.publicKey;
console.log('Buyer wallet address:', buyerPublicKey.toString());

// Helper function to derive history PDA
const getHistoryPDA = (buyerPublicKey) => {
  const [historyPDA] = PublicKey.findProgramAddressSync(
    [Buffer.from('history'), buyerPublicKey.toBuffer()],
    programId
  );
  return historyPDA;
};

// Check purchase history
async function checkPurchaseHistory() {
  try {
    console.log('\nChecking purchase history...');

    const historyPDA = getHistoryPDA(buyerPublicKey);
    console.log('History PDA:', historyPDA.toString());

    const historyAccount = await connection.getAccountInfo(historyPDA);
    if (!historyAccount) {
      console.log('No purchase history found.');
      return [];
    }

    console.log('Raw account data length:', historyAccount.data.length);

    // Deserialize the account data
    const coder = new anchor.BorshAccountsCoder(idl);
    const history = coder.decode('PurchaseHistory', historyAccount.data);

    console.log('User:', history.user.toString());
    console.log(`Found ${history.purchases.length} purchases`);

    // Display purchases
    history.purchases.forEach((purchase, index) => {
      console.log(`\nPurchase #${index + 1}:`);

      // Handle the actual format of the purchase record
      if (purchase && purchase.item_id) {
        // Convert item_id from string to number
        const itemId = parseInt(purchase.item_id, 10);
        console.log(`  Item ID: ${itemId}`);

        // Convert timestamp from hex to decimal and then to date
        if (purchase.timestamp) {
          try {
            // The raw data shows the timestamp as "67d3175f" but it's being parsed as "1741887327"
            // Let's try to parse the actual value from the raw data
            const rawData = JSON.stringify(purchase);
            const timestampMatch = rawData.match(/"timestamp":"([^"]+)"/);
            const actualTimestampHex = timestampMatch ? timestampMatch[1] : purchase.timestamp;

            console.log(`  Raw timestamp from JSON: ${actualTimestampHex}`);

            // Parse the timestamp from the hex string
            const timestampDec = parseInt(actualTimestampHex, 16);
            console.log(`  Timestamp (decimal): ${timestampDec}`);

            // Interpret as Unix timestamp (seconds since epoch)
            const dateFromUnix = new Date(timestampDec * 1000);
            console.log(`  Timestamp (as Unix seconds): ${dateFromUnix.toLocaleString()}`);

            // Current time for reference
            const currentTime = Math.floor(Date.now() / 1000); // Current time in seconds

            // Check if it might be a recent timestamp (within the last day)
            const secondsAgo = currentTime - timestampDec;
            if (secondsAgo >= 0 && secondsAgo < 86400) { // Within last 24 hours
              console.log(`  This appears to be a recent timestamp (${secondsAgo} seconds ago)`);
            }
          } catch (err) {
            console.log(`  Timestamp: Error parsing. Raw value: ${purchase.timestamp}. Error: ${err.message}`);
          }
        }

        // Show the raw purchase data for reference
        console.log(`  Raw data: ${JSON.stringify(purchase)}`);
      } else {
        console.log(`  Purchase data format is not as expected: ${JSON.stringify(purchase)}`);
      }
    });

    return history.purchases;
  } catch (error) {
    console.error('Error checking purchase history:', error);
    console.error('Error details:', error.stack);
    return [];
  }
}

// Main function
async function main() {
  try {
    await checkPurchaseHistory();
  } catch (error) {
    console.error('Error in main function:', error);
  }
}

// Run the main function
main().then(() => {
  console.log('Done!');
  process.exit(0);
}).catch(err => {
  console.error(err);
  process.exit(1);
}); 