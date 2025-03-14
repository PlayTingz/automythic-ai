import * as anchor from '@coral-xyz/anchor';
import { PublicKey, Keypair, Connection, SystemProgram } from '@solana/web3.js';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { exec } from 'child_process';

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

// Load admin wallet for reference
const adminWalletPath = process.env.ADMIN_WALLET_PATH || path.resolve('./wallets/admin.json');
const adminKeypair = Keypair.fromSecretKey(
  new Uint8Array(JSON.parse(fs.readFileSync(adminWalletPath, 'utf8')))
);
const adminPublicKey = adminKeypair.publicKey;
console.log('Admin wallet address:', adminPublicKey.toString());

// Load or create buyer wallet (ensure it's different from admin)
const buyerWalletPath = path.resolve('./wallets/buyer.json');
let buyerKeypair;

try {
  // Try to load existing buyer wallet
  buyerKeypair = Keypair.fromSecretKey(
    new Uint8Array(JSON.parse(fs.readFileSync(buyerWalletPath, 'utf8')))
  );

  // Check if buyer and admin are the same
  if (buyerKeypair.publicKey.toString() === adminPublicKey.toString()) {
    console.log('Buyer wallet is the same as admin wallet. Generating a new buyer wallet...');
    throw new Error('Need to create a new buyer wallet');
  }
} catch (err) {
  console.log(`Creating a new buyer wallet: ${err.message}`);
  buyerKeypair = Keypair.generate();

  // Save the new keypair
  const buyerWalletDir = path.dirname(buyerWalletPath);
  if (!fs.existsSync(buyerWalletDir)) {
    fs.mkdirSync(buyerWalletDir, { recursive: true });
  }

  fs.writeFileSync(
    buyerWalletPath,
    JSON.stringify(Array.from(buyerKeypair.secretKey)),
    'utf8'
  );
  console.log(`New buyer wallet saved to ${buyerWalletPath}`);
}

const buyerWallet = new anchor.Wallet(buyerKeypair);
console.log('Buyer wallet address:', buyerWallet.publicKey.toString());

// Create provider and program
const provider = new anchor.AnchorProvider(
  connection,
  buyerWallet,
  { preflightCommitment: 'confirmed' }
);
anchor.setProvider(provider);

// Create program instance
const program = new anchor.Program(idl, programId);

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

const getHistoryPDA = (buyerPublicKey) => {
  const [historyPDA] = PublicKey.findProgramAddressSync(
    [Buffer.from('history'), buyerPublicKey.toBuffer()],
    programId
  );
  return historyPDA;
};

// List all items in the shop
async function listItems() {
  try {
    console.log('Fetching shop items...');

    // Get shop account to check item count
    const shopPDA = getShopPDA();
    const shopAccount = await connection.getAccountInfo(shopPDA);

    if (!shopAccount) {
      console.error('Shop not initialized!');
      return [];
    }

    // Get all accounts owned by the program
    const accounts = await connection.getProgramAccounts(programId, {
      filters: [
        {
          // Filter for accounts that start with the Item discriminator
          dataSize: 8 + 8 + 8 + 4 + 200, // Approximate size for Item accounts
        },
      ],
    });

    console.log(`Found ${accounts.length} potential program accounts`);

    // Parse each item account
    const items = [];
    for (const account of accounts) {
      try {
        // Deserialize the account data
        const coder = new anchor.BorshAccountsCoder(idl);
        const item = coder.decode('Item', account.account.data);

        // Only add valid items with an ID and price
        if (item && item.id && item.price) {
          items.push({
            id: item.id.toString(),
            price: item.price.toString(),
            metadataUri: item.metadataUri,
            address: account.pubkey.toString()
          });
        }
      } catch (err) {
        // Skip accounts that can't be decoded as Item
        console.log(`Skipping non-item account: ${account.pubkey.toString()} (${err.message})`);
      }
    }

    console.log(`Successfully parsed ${items.length} items`);

    // Display items
    items.forEach((item, index) => {
      console.log(`\nItem #${index + 1}:`);
      console.log(`  ID: ${item.id}`);
      console.log(`  Price: ${item.price / 1_000_000_000} SOL (${item.price} lamports)`);
      console.log(`  Metadata URI: ${item.metadataUri}`);
      console.log(`  Address: ${item.address}`);
    });

    return items;
  } catch (error) {
    console.error('Error listing items:', error);
    return [];
  }
}

// Purchase an item
async function purchaseItem(itemId) {
  try {
    console.log(`Purchasing item #${itemId}...`);

    // Get PDAs
    const shopPDA = getShopPDA();
    const itemPDA = getItemPDA(itemId);
    const historyPDA = getHistoryPDA(buyerWallet.publicKey);

    console.log('Shop PDA:', shopPDA.toString());
    console.log('Item PDA:', itemPDA.toString());
    console.log('History PDA:', historyPDA.toString());

    // Get item details to check price
    const itemAccount = await connection.getAccountInfo(itemPDA);
    if (!itemAccount) {
      console.error(`Item #${itemId} not found!`);
      return false;
    }

    // Check if history account already exists
    const historyAccount = await connection.getAccountInfo(historyPDA);
    const historyExists = historyAccount !== null;
    console.log(`History account ${historyExists ? 'already exists' : 'needs to be created'}`);

    // Parse item to get price
    const coder = new anchor.BorshAccountsCoder(idl);
    const item = coder.decode('Item', itemAccount.data);
    const itemPrice = item.price.toString();
    console.log(`Item price: ${itemPrice / 1_000_000_000} SOL (${itemPrice} lamports)`);

    // Check buyer balance
    const buyerBalance = await connection.getBalance(buyerWallet.publicKey);
    console.log(`Buyer balance: ${buyerBalance / 1_000_000_000} SOL`);

    if (buyerBalance < item.price) {
      console.error(`Insufficient funds: need ${item.price / 1_000_000_000} SOL but have ${buyerBalance / 1_000_000_000} SOL`);
      return false;
    }

    // Create the transaction
    const transaction = new anchor.web3.Transaction();

    // Add a compute budget instruction to increase the compute limit
    transaction.add(
      anchor.web3.ComputeBudgetProgram.setComputeUnitLimit({
        units: 1000000
      })
    );

    if (historyExists) {
      console.log('Using subsequent_purchase instruction for existing history account...');

      // Use the subsequent_purchase instruction for existing history accounts
      const instructionData = program.coder.instruction.encode(
        "subsequentPurchase", // instruction name
        {} // no args
      );

      transaction.add(
        new anchor.web3.TransactionInstruction({
          keys: [
            { pubkey: buyerWallet.publicKey, isSigner: true, isWritable: true },
            { pubkey: shopPDA, isSigner: false, isWritable: false },
            { pubkey: itemPDA, isSigner: false, isWritable: false },
            { pubkey: adminPublicKey, isSigner: false, isWritable: true },
            { pubkey: historyPDA, isSigner: false, isWritable: true },
            { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
          ],
          programId,
          data: instructionData
        })
      );
    } else {
      console.log('Using first_purchase instruction to create history account...');

      // Use the first_purchase instruction for new history accounts
      const instructionData = program.coder.instruction.encode(
        "firstPurchase", // instruction name
        {} // no args
      );

      transaction.add(
        new anchor.web3.TransactionInstruction({
          keys: [
            { pubkey: buyerWallet.publicKey, isSigner: true, isWritable: true },
            { pubkey: shopPDA, isSigner: false, isWritable: false },
            { pubkey: itemPDA, isSigner: false, isWritable: false },
            { pubkey: adminPublicKey, isSigner: false, isWritable: true },
            { pubkey: historyPDA, isSigner: false, isWritable: true },
            { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
          ],
          programId,
          data: instructionData
        })
      );
    }

    // Send and confirm transaction
    const signature = await anchor.web3.sendAndConfirmTransaction(
      connection,
      transaction,
      [buyerKeypair]
    );

    console.log('Transaction successful!');
    console.log('Signature:', signature);
    console.log(`Explorer URL: https://explorer.sonic.game/tx/${signature}?cluster=${network}`);

    // Check purchase history
    await checkPurchaseHistoryForWallet(buyerWallet.publicKey);

    return true;
  } catch (error) {
    console.error('Error purchasing item:', error);
    return false;
  }
}

// Check purchase history for a specific wallet
async function checkPurchaseHistoryForWallet(walletPublicKey) {
  try {
    console.log(`\nChecking purchase history for wallet: ${walletPublicKey.toString()}...`);

    const historyPDA = getHistoryPDA(walletPublicKey);
    console.log('History PDA:', historyPDA.toString());

    const historyAccount = await connection.getAccountInfo(historyPDA);
    if (!historyAccount) {
      console.log('No purchase history found.');
      return [];
    }

    // Deserialize the account data
    const coder = new anchor.BorshAccountsCoder(idl);
    const history = coder.decode('PurchaseHistory', historyAccount.data);

    console.log(`Found ${history.purchases.length} purchases for ${history.user.toString()}`);

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
    return [];
  }
}

// Main function
async function main() {
  try {
    // Check buyer wallet balance using Solana CLI
    console.log('Checking buyer wallet balance...');

    // Create a function to execute shell commands
    const execCommand = (command) => {
      return new Promise((resolve, reject) => {
        exec(command, (error, stdout, stderr) => {
          if (error) {
            console.error(`Command error: ${stderr}`);
            reject(error);
            return;
          }
          resolve(stdout.trim());
        });
      });
    };

    // Check balance using Solana CLI
    try {
      const balanceOutput = await execCommand(`solana balance ${buyerWallet.publicKey.toString()} --url ${rpcUrl}`);
      console.log(`Buyer balance: ${balanceOutput}`);

      // Extract the balance value (assuming format like "5 SOL")
      const balanceMatch = balanceOutput.match(/(\d+(\.\d+)?)/);
      const balanceInSol = balanceMatch ? parseFloat(balanceMatch[0]) : 0;

      if (balanceInSol < 2) {
        console.log('Buyer wallet has insufficient funds. Requesting airdrop...');

        // Request airdrop using Solana CLI
        const airdropOutput = await execCommand(`solana airdrop 2 ${buyerWallet.publicKey.toString()} --url ${rpcUrl}`);
        console.log('Airdrop result:', airdropOutput);

        // Check new balance
        const newBalanceOutput = await execCommand(`solana balance ${buyerWallet.publicKey.toString()} --url ${rpcUrl}`);
        console.log(`New buyer balance: ${newBalanceOutput}`);
      }
    } catch (err) {
      console.error('Error with Solana CLI commands:', err.message);
      console.log('Falling back to transferring SOL from admin wallet...');

      // Transfer SOL from admin to buyer as fallback
      const adminBalance = await connection.getBalance(adminPublicKey);
      console.log(`Admin balance: ${adminBalance / 1_000_000_000} SOL`);

      if (adminBalance > 2 * anchor.web3.LAMPORTS_PER_SOL) {
        const transferAmount = 2 * anchor.web3.LAMPORTS_PER_SOL; // 2 SOL

        const transaction = new anchor.web3.Transaction().add(
          anchor.web3.SystemProgram.transfer({
            fromPubkey: adminPublicKey,
            toPubkey: buyerWallet.publicKey,
            lamports: transferAmount,
          })
        );

        const signature = await anchor.web3.sendAndConfirmTransaction(
          connection,
          transaction,
          [adminKeypair]
        );

        console.log(`Transferred 2 SOL from admin to buyer. Signature: ${signature}`);
        console.log(`New buyer balance: ${await connection.getBalance(buyerWallet.publicKey) / 1_000_000_000} SOL`);
      } else {
        console.error('Admin wallet has insufficient funds to transfer.');
      }
    }

    // List available items
    const items = await listItems();

    if (items.length === 0) {
      console.log('No items available in the shop.');
      return;
    }

    // Get item ID from command line args or prompt
    const itemIdArg = process.argv[3];
    const itemId = itemIdArg ? parseInt(itemIdArg) : parseInt(items[0].id);

    console.log(`\nSelected item ID for purchase: ${itemId}`);

    // Purchase the item
    const success = await purchaseItem(itemId);

    if (success) {
      // The purchase history check is now handled inside the purchaseItem function
      // for new buyer wallets, so we don't need to do anything here
    }
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