# Digital Item Shop on Solana

A Solana smart contract for a digital item shop that allows:

- Admin to add items with metadata stored on IPFS via NFT.Storage
- Users to purchase items with SOL
- Tracking purchase history for each user

## Project Structure

- `programs/shop/src/lib.rs` - Solana program (smart contract)
- `scripts/upload-metadata.js` - Script to upload metadata to NFT.Storage
- `examples/` - Example items
- `scripts/shop-client.js` - Client script to interact with the Solana program
- `scripts/generate-wallet.js` - Script to generate a Solana wallet keypair

## Setup

1. Clone the repository
2. Install dependencies:

```bash
yarn install
```

3. Copy the environment variables template:

```bash
cp .env.example .env
```

4. Edit `.env` and add your NFT.Storage API key and other settings

> **Note:** This project uses ES modules. Make sure you're using Node.js version 14.16.0 or later.

## Generating a Wallet

You need a wallet keypair to deploy and interact with your contract. Use our script to generate one:

```bash
node scripts/generate-wallet.js
```

This will:

- Create a `wallets` directory if it doesn't exist
- Generate a new Solana keypair
- Save it to `wallets/admin.json`
- Display the public key

Make sure to fund this wallet with SOL on the Sonic network you're using.

For testnet, you can get SOL from the faucet: https://faucet.sonic.game

## Sonic Networks

This project supports multiple Sonic networks:

- **Testnet**: `https://api.testnet.sonic.game`
- **Mainnet Alpha**: `https://api.mainnet-alpha.sonic.game`
- **Helius RPC**: `https://sonic.helius-rpc.com/`

You can get testnet SOL from the faucet: `https://faucet.sonic.game`

## Building and Deploying

```bash
node scripts/deploy.js
```

The deploy script will:

- Build the program
- Get the program ID
- Update the program ID in the .env file
- Deploy to the specified Sonic network (default testnet)

## Using the Shop

### Initialize the Shop

```bash
# On testnet (default)
node scripts/shop-client.js init
```

### Add an Item to the Shop (might take a couple of seconds to upload to the contract)

```bash
# On testnet
node scripts/add-item-with-metadata.js testnet examples/character-metadata.json
```

### Purchase an Item

```bash
# On testnet
node scripts/shop-client.js purchase 1

```

### View Item Details

```bash
# On testnet
node scripts/shop-client.js get-item 1
```

### View Purchase History

```bash
# On testnet
node scripts/shop-client.js get-history
```

## Data Structures

### Shop Account (PDA)

```rust
pub struct Shop {
    pub admin: Pubkey,
    pub item_count: u64,
}
```

### Item Account (PDA)

```rust
pub struct Item {
    pub id: u64,
    pub price: u64,
    pub metadata_uri: String,
}
```

### Purchase History Account (PDA)

```rust
pub struct PurchaseHistory {
    pub user: Pubkey,
    pub purchases: Vec<PurchaseRecord>,
}

pub struct PurchaseRecord {
    pub item_id: u64,
    pub timestamp: i64,
}
```

## Viewing Transactions

You can view your transactions on the Sonic Block Explorer:

```
https://explorer.sonic.game
```

## License

MIT
