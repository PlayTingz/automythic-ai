#!/usr/bin/env node
import { Keypair } from '@solana/web3.js';
import fs from 'fs';
import path from 'path';

// Create wallets directory if it doesn't exist
const walletsDir = path.resolve('./wallets');
if (!fs.existsSync(walletsDir)) {
  fs.mkdirSync(walletsDir, { recursive: true });
}

// Generate a new keypair
const keypair = Keypair.generate();

// Save the keypair to a file
const walletPath = path.join(walletsDir, 'admin.json');
fs.writeFileSync(
  walletPath,
  JSON.stringify(Array.from(keypair.secretKey)),
  'utf-8'
);

console.log(`Wallet keypair generated and saved to ${walletPath}`);
console.log(`Public key: ${keypair.publicKey.toString()}`);
console.log('\nMake sure to fund this wallet with SOL before deploying your contract.');
console.log('For testnet, you can use the Sonic faucet: https://faucet.sonic.game'); 