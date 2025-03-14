'use client'

import { SolanaProvider } from '@/wallets/solana'

export const NearProvider = ({ children }: { children: React.ReactNode }) => {
  // For backward compatibility, we'll keep the NearProvider name but use Solana inside
  return <SolanaProvider>{children}</SolanaProvider>
}
