#!/usr/bin/env node
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  cyan: '\x1b[36m'
};

// Helper function to run commands
function runCommand(command, errorMessage) {
  try {
    console.log(`${colors.cyan}> ${command}${colors.reset}`);
    return execSync(command, { stdio: 'inherit' });
  } catch {
    console.error(`${colors.red}${errorMessage}${colors.reset}`);
    process.exit(1);
  }
}

// Main deployment function
async function deploy() {
  // Get network from command line args
  const network = process.argv[2] || 'testnet';

  let clusterName;
  let networkName;

  switch (network.toLowerCase()) {
    case 'mainnet':
    case 'main':
    case 'sonic-mainnet':
    case 'mainnet-alpha':
      clusterName = 'mainnet';
      networkName = 'Sonic Mainnet Alpha';
      break;
    case 'helius':
      clusterName = 'helius';
      networkName = 'Sonic Helius RPC';
      break;
    case 'sonic-testnet':
    case 'testnet':
    case 'test':
    default:
      clusterName = 'testnet';
      networkName = 'Sonic Testnet';
      break;
  }

  console.log(`\n${colors.bright}${colors.yellow}=== Deploying Shop Program to ${networkName} ===${colors.reset}\n`);

  // Step 1: Build the program
  console.log(`\n${colors.bright}${colors.green}Step 1: Building the program...${colors.reset}`);
  runCommand('anchor build', 'Failed to build the program');

  // Step 2: Get the program ID
  console.log(`\n${colors.bright}${colors.green}Step 2: Getting program ID...${colors.reset}`);
  const programKeypairPath = path.resolve('./target/deploy/shop-keypair.json');

  if (!fs.existsSync(programKeypairPath)) {
    console.error(`${colors.red}Program keypair not found at ${programKeypairPath}${colors.reset}`);
    process.exit(1);
  }

  const programId = execSync(`solana address -k ${programKeypairPath}`).toString().trim();
  console.log(`${colors.cyan}Program ID: ${programId}${colors.reset}`);

  // Step 3: Update program ID in lib.rs
  console.log(`\n${colors.bright}${colors.green}Step 3: Updating program ID in lib.rs...${colors.reset}`);
  const libRsPath = path.resolve('./programs/shop/src/lib.rs');
  let libRsContent = fs.readFileSync(libRsPath, 'utf8');

  // Replace the program ID
  libRsContent = libRsContent.replace(
    /declare_id!\("([^"]*)"\);/,
    `declare_id!("${programId}");`
  );

  fs.writeFileSync(libRsPath, libRsContent);
  console.log(`${colors.cyan}Updated program ID in lib.rs${colors.reset}`);

  // Step 4: Update program ID in Anchor.toml
  console.log(`\n${colors.bright}${colors.green}Step 4: Updating program ID in Anchor.toml...${colors.reset}`);
  const anchorTomlPath = path.resolve('./Anchor.toml');
  let anchorTomlContent = fs.readFileSync(anchorTomlPath, 'utf8');

  // Replace all program IDs in the [programs] section
  anchorTomlContent = anchorTomlContent.replace(
    /shop = "([^"]*)"/g,
    `shop = "${programId}"`
  );

  fs.writeFileSync(anchorTomlPath, anchorTomlContent);
  console.log(`${colors.cyan}Updated program ID in Anchor.toml${colors.reset}`);

  // Step 5: Build again with the updated program ID
  console.log(`\n${colors.bright}${colors.green}Step 5: Building again with updated program ID...${colors.reset}`);
  runCommand('anchor build', 'Failed to build the program with updated program ID');

  // Step 6: Deploy to Sonic network
  console.log(`\n${colors.bright}${colors.green}Step 6: Deploying to ${networkName}...${colors.reset}`);

  // Use explicit URLs for Sonic networks instead of standard cluster names
  let deployCommand;
  switch (clusterName) {
    case 'mainnet':
      deployCommand = `solana program deploy --program-id ${programKeypairPath} --keypair ./wallets/admin.json --url https://api.mainnet-alpha.sonic.game target/deploy/shop.so`;
      break;
    case 'helius':
      deployCommand = `solana program deploy --program-id ${programKeypairPath} --keypair ./wallets/admin.json --url https://sonic.helius-rpc.com/ target/deploy/shop.so`;
      break;
    default: // testnet
      deployCommand = `solana program deploy --program-id ${programKeypairPath} --keypair ./wallets/admin.json --url https://api.testnet.sonic.game target/deploy/shop.so`;
      break;
  }

  runCommand(deployCommand, `Failed to deploy to ${networkName}`);

  console.log(`\n${colors.bright}${colors.green}=== Deployment Successful! ===${colors.reset}`);
  console.log(`\n${colors.cyan}Program ID: ${programId}${colors.reset}`);
  console.log(`\n${colors.bright}${colors.yellow}Next steps:${colors.reset}`);
  console.log(`${colors.cyan}1. Initialize the shop: node scripts/shop-client.js init${colors.reset}`);
  console.log(`${colors.cyan}2. Upload metadata: node scripts/upload-metadata.js${colors.reset}`);
  console.log(`${colors.cyan}3. Add items: node scripts/shop-client.js add-item <id> <price> <metadataUri>${colors.reset}`);

  // If testnet, show faucet info
  if (networkName === 'Sonic Testnet') {
    const faucetUrl = process.env.SONIC_FAUCET_URL || 'https://faucet.sonic.game';
    console.log(`\n${colors.bright}${colors.yellow}Need testnet SOL?${colors.reset}`);
    console.log(`${colors.cyan}Visit the Sonic faucet: ${faucetUrl}${colors.reset}`);
  }

  // Show explorer info
  const explorerUrl = process.env.SONIC_EXPLORER_URL || 'https://explorer.sonic.game';
  console.log(`\n${colors.bright}${colors.yellow}View your transactions:${colors.reset}`);
  console.log(`${colors.cyan}Sonic Explorer: ${explorerUrl}${colors.reset}`);
}

// Run the deployment
deploy().catch(err => {
  console.error(`${colors.red}Deployment failed: ${err}${colors.reset}`);
  process.exit(1);
}); 