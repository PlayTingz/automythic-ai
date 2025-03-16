'use client'

import { createContext, ReactNode, useMemo } from 'react'
import { ConnectionProvider, WalletProvider } from '@solana/wallet-adapter-react'
import { WalletModalProvider } from '@solana/wallet-adapter-react-ui'
import { SOLANA_RPC_URL } from '@/lib/config'

// Import wallet adapter styles
import '@solana/wallet-adapter-react-ui/styles.css'

// Create a context for Solana
export const SolanaContext = createContext({})

export function SolanaProvider({ children }: { children: ReactNode }) {
  // Use the configured RPC endpoint
  const endpoint = SOLANA_RPC_URL

  // Use an empty array to let the adapter auto-detect wallets
  const wallets = useMemo(() => [], [])

  return (
    <ConnectionProvider endpoint={endpoint}>
      <WalletProvider wallets={wallets} autoConnect>
        <WalletModalProvider>{children}</WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  )
} 