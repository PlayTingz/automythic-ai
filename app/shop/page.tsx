'use client'

import { useState, useEffect } from 'react'
import { Connection, PublicKey, Transaction, SystemProgram, ComputeBudgetProgram } from '@solana/web3.js'
import { Buffer } from 'buffer'
import Image from 'next/image'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { useWallet } from '@solana/wallet-adapter-react'
import { SOLANA_RPC_URL } from '@/lib/config'

// Define the item interface
interface ShopItem {
  id: number
  name: string
  description: string
  image: string
  price: number
  metadataUri: string
}

// Interface for IPFS metadata
interface IPFSMetadata {
  name: string
  description: string
  image?: string
  image_url?: string
  item_type?: string
  attributes?: Array<{
    trait_type: string
    value: string | number
  }>
}

// Interface for purchase history
interface PurchaseRecord {
  item_id: number
  timestamp: number
}

interface PurchaseHistory {
  user: PublicKey
  purchases: PurchaseRecord[]
}

// Placeholder images for different item types
const placeholderImages: Record<string, string> = {
  default: '/items/placeholder.png',
  sword: '/items/sword.png',
  shield: '/items/shield.png',
  potion: '/items/potion.png',
}

// Define the instruction discriminators from the IDL
const INSTRUCTION_DISCRIMINATORS = {
  firstPurchase: [109, 212, 45, 217, 228, 42, 205, 63],
  subsequentPurchase: [223, 75, 242, 206, 210, 168, 187, 166]
};

const SHOP_PROGRAM_ID: string = process.env.NEXT_PUBLIC_SHOP_PROGRAM_ID || ''

export default function ShopPage() {
  const [isPurchasing, setIsPurchasing] = useState<number | null>(null)
  const [shopItems, setShopItems] = useState<ShopItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [purchaseHistory, setPurchaseHistory] = useState<PurchaseRecord[]>([])
  const wallet = useWallet()

  // Solana connection setup
  const rpcUrl = SOLANA_RPC_URL
  const programId = SHOP_PROGRAM_ID

  // Helper function to derive PDAs
  const getShopPDA = (programId: PublicKey) => {
    const [shopPDA] = PublicKey.findProgramAddressSync(
      [Buffer.from('shop')],
      programId
    );
    return shopPDA;
  };

  const getItemPDA = (programId: PublicKey, id: number) => {
    // Create a buffer for the item ID (8 bytes)
    const idBuffer = Buffer.alloc(8)
    idBuffer.writeBigUInt64LE(BigInt(id))

    // Find the program address
    const [pda] = PublicKey.findProgramAddressSync(
      [Buffer.from('item'), idBuffer],
      programId
    )

    return pda
  }

  const getHistoryPDA = (programId: PublicKey, buyerPublicKey: PublicKey) => {
    const [historyPDA] = PublicKey.findProgramAddressSync(
      [Buffer.from('history'), buyerPublicKey.toBuffer()],
      programId
    );
    return historyPDA;
  };

  // Helper function to convert IPFS URI to HTTP URL
  const ipfsToHttp = (ipfsUri: string): string => {
    if (!ipfsUri) return ''

    // Replace ipfs:// with a gateway URL
    if (ipfsUri.startsWith('ipfs://')) {
      const cid = ipfsUri.replace('ipfs://', '')
      return `https://ipfs.io/ipfs/${cid}`
    }

    return ipfsUri
  }

  // Fetch metadata from IPFS
  const fetchMetadata = async (metadataUri: string): Promise<IPFSMetadata | null> => {
    try {
      // For demo purposes, return mock data for the placeholder CID
      if (metadataUri === 'ipfs://placeholder-cid-for-excalibur') {
        return {
          name: 'Excalibur',
          description: 'The legendary sword of King Arthur. This powerful weapon grants its wielder enhanced strength and magical abilities.',
          image: placeholderImages.sword
        }
      }

      // Convert IPFS URI to HTTP URL
      const metadataUrl = ipfsToHttp(metadataUri)

      if (!metadataUrl) {
        console.warn('Invalid metadata URI:', metadataUri)
        return null
      }

      // Fetch metadata from IPFS gateway
      console.log('Fetching metadata from:', metadataUrl)
      const response = await fetch(metadataUrl)

      if (!response.ok) {
        console.warn(`Failed to fetch metadata: ${response.status} ${response.statusText}`)
        return null
      }

      const metadata = await response.json()
      return metadata
    } catch (error) {
      console.error('Error fetching metadata:', error)
      return null
    }
  }

  // Fetch item details from Solana
  const fetchItemDetails = async (
    connection: Connection,
    programId: PublicKey,
    id: number
  ): Promise<ShopItem | null> => {
    try {
      const itemPDA = getItemPDA(programId, id)
      console.log(`Fetching item ${id} at address:`, itemPDA.toString())

      const accountInfo = await connection.getAccountInfo(itemPDA)

      if (!accountInfo || !accountInfo.data) {
        console.log(`No account found for item ${id}`)
        return null
      }

      // Parse the account data
      const data = accountInfo.data

      // Skip the 8-byte discriminator
      let offset = 8

      // Read the item ID (8 bytes for u64)
      const itemId = Number(data.readBigUInt64LE(offset))
      offset += 8

      // Read the price (8 bytes for u64)
      const price = Number(data.readBigUInt64LE(offset)) / 1_000_000_000 // Convert lamports to SOL
      offset += 8

      // Read the metadata URI length (4 bytes)
      const metadataUriLength = data.readUInt32LE(offset)
      offset += 4

      // Read the metadata URI
      const metadataUri = data.slice(offset, offset + metadataUriLength).toString('utf8')

      console.log(`Raw item data for ${id}:`, {
        id: itemId,
        price,
        metadataUriLength,
        metadataUri
      })

      // Default item data
      let name = `Item #${id}`
      let description = 'A mysterious item from the blockchain'
      let image = placeholderImages.default

      // Check if this is a simplified metadata format (image:URL)
      if (metadataUri.startsWith('image:')) {
        const imageUrl = metadataUri.substring(6) // Remove 'image:' prefix

        if (imageUrl) {
          image = imageUrl

          // Try to determine item type from the image URL or ID
          if (id === 1) {
            name = 'Excalibur'
            description = 'A legendary sword of immense power. Said to have been wielded by the greatest kings of old.'
          } else if (id === 2) {
            name = 'Luna the Shadow Thief'
            description = 'A stealthy rogue with a knack for secrets. Luna can infiltrate any fortress and steal the most guarded treasures.'
          } else if (id === 3) {
            name = 'Mystic Cavern'
            description = 'A glowing cave filled with ancient runes. The walls shimmer with magical energy, illuminating the mysterious symbols carved into the stone.'
          } else if (id === 4) {
            name = 'Spectral Fade'
            description = 'A ghostly fade effect for your choices. This ethereal animation adds a supernatural touch to scene transitions, creating an atmosphere of mystery.'
          }
        }
      } else if (metadataUri) {
        // Try to fetch metadata if it's a JSON or IPFS URI
        try {
          const metadata = await fetchMetadata(metadataUri)

          if (metadata) {
            name = metadata.name || name
            description = metadata.description || description

            // Use image_url if available, otherwise fall back to image
            if (metadata.image_url) {
              image = metadata.image_url
            } else if (metadata.image) {
              // Convert IPFS image URI to HTTP URL if needed
              if (metadata.image.startsWith('ipfs://')) {
                image = ipfsToHttp(metadata.image)
              } else if (metadata.image.startsWith('http')) {
                image = metadata.image
              } else {
                // For demo purposes, use placeholder images based on item type
                const itemType = (metadata.item_type || '').toLowerCase()
                if (itemType.includes('weapon') || name.toLowerCase().includes('sword')) {
                  image = placeholderImages.sword
                } else if (itemType.includes('shield')) {
                  image = placeholderImages.shield
                } else if (itemType.includes('potion')) {
                  image = placeholderImages.potion
                }
              }
            }
          }
        } catch (error) {
          console.error(`Error fetching metadata for item ${id}:`, error)
        }
      }

      return {
        id: itemId,
        name,
        description,
        image,
        price,
        metadataUri
      }
    } catch (error) {
      console.error(`Error fetching item ${id}:`, error)
      return null
    }
  }

  // Fetch all items
  const fetchItems = async () => {
    setIsLoading(true)
    try {
      const connection = new Connection(rpcUrl)
      const programPubkey = new PublicKey(programId)

      const items: ShopItem[] = []

      // Try to fetch items with IDs from 1 to 10
      for (let id = 1; id <= 10; id++) {
        try {
          const item = await fetchItemDetails(connection, programPubkey, id)
          if (item) {
            items.push(item)
            console.log(`Fetched item ${id}:`, item)
          }
        } catch (error) {
          console.log(`No item found with ID ${id}`, error)
          // Continue to the next ID if this one doesn't exist
        }
      }

      setShopItems(items)
    } catch (error) {
      console.error('Error fetching shop items:', error)
      setError('Failed to load shop items. Please try again later.')
    } finally {
      setIsLoading(false)
    }
  }

  // Check purchase history for the connected wallet
  const checkPurchaseHistory = async () => {
    if (!wallet.connected || !wallet.publicKey) return;

    try {
      const connection = new Connection(rpcUrl, 'confirmed');
      const programPubkey = new PublicKey(programId);

      // Get history PDA
      const historyPDA = getHistoryPDA(programPubkey, wallet.publicKey);
      console.log('Checking purchase history at:', historyPDA.toString());

      // Get history account
      const historyAccount = await connection.getAccountInfo(historyPDA);
      if (!historyAccount) {
        console.log('No purchase history found');
        setPurchaseHistory([]);
        return;
      }

      // Skip 8 bytes discriminator, then read user pubkey (32 bytes)
      // Then read purchases array
      // This is a simplified parsing approach - in a production app, you'd use a proper BorshAccountsCoder

      try {
        // Create a simple parser for the PurchaseHistory account
        // In a real app, you would use the Anchor BorshAccountsCoder
        const data = historyAccount.data;

        // Skip 8 bytes discriminator
        let offset = 8;

        // Read user pubkey (32 bytes)
        const userPubkey = new PublicKey(data.slice(offset, offset + 32));
        offset += 32;

        // Verify this is the correct user
        if (!userPubkey.equals(wallet.publicKey)) {
          console.error('History account belongs to a different user');
          setPurchaseHistory([]);
          return;
        }

        // Read purchases array length (4 bytes)
        const purchasesLength = data.readUInt32LE(offset);
        offset += 4;

        console.log(`Found ${purchasesLength} purchases`);

        // Parse each purchase record (item_id: u64, timestamp: i64)
        const purchases: PurchaseRecord[] = [];
        for (let i = 0; i < purchasesLength; i++) {
          const itemId = Number(data.readBigUInt64LE(offset));
          offset += 8;

          const timestamp = Number(data.readBigInt64LE(offset));
          offset += 8;

          purchases.push({ item_id: itemId, timestamp });
        }

        // Create a PurchaseHistory object
        const history: PurchaseHistory = {
          user: userPubkey,
          purchases
        };

        console.log('Parsed purchase history:', history);
        setPurchaseHistory(history.purchases);
      } catch (error) {
        console.error('Error parsing purchase history:', error);
        // For now, we'll just set a placeholder to indicate there are purchases
        setPurchaseHistory([{ item_id: 1, timestamp: Date.now() / 1000 }]);
      }
    } catch (error) {
      console.error('Error checking purchase history:', error);
    }
  };

  // Fetch items and purchase history on component mount
  useEffect(() => {
    fetchItems();
    if (wallet.connected) {
      checkPurchaseHistory();
    }
  }, [wallet.connected]);

  // Handle purchase button click
  const handlePurchase = async (itemId: number) => {
    if (!wallet.connected || !wallet.publicKey) {
      toast.error('Wallet not connected', {
        description: 'Please connect your wallet to make a purchase.',
        action: {
          label: 'Connect Wallet',
          onClick: () => {
            const walletButton = document.querySelector('.wallet-adapter-button');
            if (walletButton) {
              (walletButton as HTMLElement).click();
            }
          },
        },
      });
      return;
    }

    setIsPurchasing(itemId);
    try {
      const connection = new Connection(rpcUrl, 'confirmed');
      const programPubkey = new PublicKey(programId);

      // Get PDAs
      const shopPDA = getShopPDA(programPubkey);
      const itemPDA = getItemPDA(programPubkey, itemId);
      const historyPDA = getHistoryPDA(programPubkey, wallet.publicKey);

      console.log('Shop PDA:', shopPDA.toString());
      console.log('Item PDA:', itemPDA.toString());
      console.log('History PDA:', historyPDA.toString());

      // Get admin public key from the shop account
      const shopAccount = await connection.getAccountInfo(shopPDA);
      if (!shopAccount) {
        throw new Error('Shop not initialized');
      }

      // Skip 8 bytes discriminator, admin pubkey is the first field
      const adminPubkey = new PublicKey(shopAccount.data.slice(8, 40));

      // Get item details to check price
      const itemAccount = await connection.getAccountInfo(itemPDA);
      if (!itemAccount) {
        throw new Error(`Item #${itemId} not found!`);
      }

      // Parse item to get price (skip 8 bytes discriminator, then 8 bytes for id, then read 8 bytes for price)
      const itemPrice = Number(itemAccount.data.readBigUInt64LE(16));
      console.log(`Item price: ${itemPrice / 1_000_000_000} SOL (${itemPrice} lamports)`);

      // Check buyer balance
      const buyerBalance = await connection.getBalance(wallet.publicKey);
      console.log(`Buyer balance: ${buyerBalance / 1_000_000_000} SOL`);

      if (buyerBalance < itemPrice) {
        throw new Error(`Insufficient funds: need ${itemPrice / 1_000_000_000} SOL but have ${buyerBalance / 1_000_000_000} SOL`);
      }

      // Check if history account already exists
      const historyAccount = await connection.getAccountInfo(historyPDA);
      const historyExists = historyAccount !== null;
      console.log(`History account ${historyExists ? 'already exists' : 'needs to be created'}`);

      // Create the transaction
      const transaction = new Transaction();

      // Add a compute budget instruction to increase the compute limit
      transaction.add(
        ComputeBudgetProgram.setComputeUnitLimit({
          units: 1000000
        })
      );

      // Create the instruction data
      // We need to use the correct discriminator from the IDL
      const instructionName = historyExists ? 'subsequentPurchase' : 'firstPurchase';
      const discriminator = INSTRUCTION_DISCRIMINATORS[instructionName];
      const dataLayout = Buffer.from(discriminator);

      // Add the instruction to the transaction
      transaction.add({
        keys: [
          { pubkey: wallet.publicKey, isSigner: true, isWritable: true },
          { pubkey: shopPDA, isSigner: false, isWritable: false },
          { pubkey: itemPDA, isSigner: false, isWritable: false },
          { pubkey: adminPubkey, isSigner: false, isWritable: true },
          { pubkey: historyPDA, isSigner: false, isWritable: true },
          { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
        ],
        programId: programPubkey,
        data: dataLayout
      });

      // Get a recent blockhash and set it on the transaction
      const { blockhash } = await connection.getLatestBlockhash('confirmed');
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = wallet.publicKey;

      // Sign and send the transaction
      if (!wallet.signTransaction) {
        throw new Error('Wallet does not support signing transactions');
      }

      try {
        // Request signature from the wallet
        const signedTransaction = await wallet.signTransaction(transaction);

        // Send the signed transaction
        const signature = await connection.sendRawTransaction(signedTransaction.serialize());

        // Wait for confirmation
        await connection.confirmTransaction(signature, 'confirmed');

        console.log('Transaction successful!');
        console.log('Signature:', signature);

        toast.success('Purchase successful!', {
          description: `You have successfully purchased item #${itemId}`,
        });

        // Refresh purchase history
        await checkPurchaseHistory();

        // Provide a link to the transaction
        const explorerUrl = `https://explorer.sonic.game/tx/${signature}?cluster=testnet`;
        toast.info('View transaction', {
          description: (
            <a href={explorerUrl} target="_blank" rel="noopener noreferrer" className="text-blue-500 underline">
              View on Sonic Explorer
            </a>
          ),
          duration: 10000,
        });
      } catch (error) {
        console.error('Transaction error:', error);
        throw error;
      }
    } catch (error) {
      console.error('Purchase error:', error);
      toast.error('Purchase failed', {
        description: error instanceof Error ? error.message : 'There was an error processing your purchase.',
      });
    } finally {
      setIsPurchasing(null);
    }
  }

  return (
    <div className="min-h-[80vh] pt-24 bg-black text-white p-8">
      <h1 className="text-4xl font-bold text-purple-400 text-center mb-8">
        Adventure Shop
      </h1>
      <p className="text-gray-400 text-center mb-12">
        Spend SOL tokens to unlock characters, scenes, and animations!
      </p>

      {isLoading ? (
        <div className="flex flex-col items-center justify-center">
          <p className="text-gray-300 mb-4">Loading shop items...</p>
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-purple-500"></div>
        </div>
      ) : error ? (
        <div className="text-center text-red-500 p-4 rounded-lg bg-red-100">
          {error}
        </div>
      ) : shopItems.length === 0 ? (
        <div className="flex flex-col items-center justify-center">
          <p className="text-gray-300 mb-4">No items found in the shop.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
          {shopItems.map((item) => {
            // Check if this item is already purchased
            const isPurchased = purchaseHistory.some(purchase => purchase.item_id === item.id);

            return (
              <Card
                key={item.id}
                className={`bg-gray-900/80 border-gray-800 hover:shadow-indigo-500/20 transition-shadow duration-300 ${isPurchased ? 'border-green-500 border-2' : ''}`}
              >
                <CardHeader>
                  <div className="relative w-full h-48 rounded-t-lg overflow-hidden bg-gray-800">
                    <Image
                      src={item.image}
                      alt={item.name}
                      fill
                      className="object-contain transition-transform duration-300 hover:scale-105"
                      onError={(e) => {
                        // Fallback to default image if the item image fails to load
                        const target = e.target as HTMLImageElement;
                        target.src = placeholderImages.default;
                      }}
                    />
                    {isPurchased && (
                      <div className="absolute top-2 right-2 bg-green-500 text-white px-2 py-1 rounded-md text-xs font-bold">
                        Purchased
                      </div>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  <CardTitle className="text-xl font-bold text-white">
                    {item.name}
                  </CardTitle>
                  <CardDescription className="text-gray-300 mt-2 line-clamp-3">
                    {item.description}
                  </CardDescription>
                  {item.metadataUri && (
                    <p className="text-xs text-gray-500 mt-2 truncate">
                      Metadata: {item.metadataUri}
                    </p>
                  )}
                </CardContent>
                <CardFooter className="flex justify-between items-center">
                  <span className="text-indigo-400 font-semibold">
                    {item.price} SOL
                  </span>
                  <Button
                    onClick={() => handlePurchase(item.id)}
                    disabled={isPurchasing === item.id || isPurchased}
                    className={`${isPurchased
                      ? 'bg-green-600 hover:bg-green-700 cursor-not-allowed'
                      : 'bg-indigo-600 hover:bg-indigo-700'} text-white`}
                  >
                    {isPurchased
                      ? 'Owned'
                      : isPurchasing === item.id
                        ? 'Purchasing...'
                        : 'Purchase'}
                  </Button>
                </CardFooter>
              </Card>
            );
          })}
        </div>
      )}

      {/* Transaction History Section */}
      {wallet.connected && (
        <div className="mt-16 max-w-4xl mx-auto">
          <h2 className="text-2xl font-bold text-purple-400 mb-6">Transaction History</h2>
          {purchaseHistory.length > 0 ? (
            <div className="bg-gray-900/80 rounded-lg p-6 border border-gray-800">
              <div className="space-y-4">
                {purchaseHistory.map((purchase, index) => {
                  const item = shopItems.find(item => item.id === purchase.item_id);
                  const date = new Date(purchase.timestamp * 1000);

                  return (
                    <div key={index} className="flex items-center justify-between p-4 bg-gray-800/50 rounded-lg">
                      <div className="flex items-center space-x-4">
                        {item && (
                          <div className="relative w-12 h-12 rounded overflow-hidden">
                            <Image
                              src={item.image}
                              alt={item.name}
                              fill
                              className="object-cover"
                              onError={(e) => {
                                const target = e.target as HTMLImageElement;
                                target.src = placeholderImages.default;
                              }}
                            />
                          </div>
                        )}
                        <div>
                          <p className="text-white font-medium">
                            {item ? item.name : `Item #${purchase.item_id}`}
                          </p>
                          <p className="text-sm text-gray-400">
                            {date.toLocaleDateString()} at {date.toLocaleTimeString()}
                          </p>
                        </div>
                      </div>
                      <div className="text-green-400 font-medium">
                        {item ? `${item.price} SOL` : 'Price unknown'}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="text-center text-gray-400 py-8 bg-gray-900/80 rounded-lg border border-gray-800">
              No transactions found. Make your first purchase to see it here!
            </div>
          )}
        </div>
      )}
    </div>
  )
}
