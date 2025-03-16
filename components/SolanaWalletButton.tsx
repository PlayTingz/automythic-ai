'use client'

import { useWallet } from '@solana/wallet-adapter-react'
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui'
import { cn } from '@/lib/utils'
import { useState, useEffect } from 'react'

interface SolanaWalletButtonProps {
  label?: string // Custom label (e.g., "Play Now" or "Connect Wallet")
  className?: string
}

export function SolanaWalletButton({
  label,
  className,
}: SolanaWalletButtonProps) {
  const { connected } = useWallet()
  const [mounted, setMounted] = useState(false)

  // Only show the component after it's mounted on the client
  useEffect(() => {
    setMounted(true)
  }, [])

  // Custom styling to match your app's design
  const buttonClass = cn(
    'wallet-adapter-button',
    'bg-purple-300 text-black hover:bg-purple-400 disabled:opacity-50 disabled:cursor-not-allowed',
    className
  )

  // Don't render anything until mounted to prevent hydration errors
  if (!mounted) {
    return (
      <button className={buttonClass} disabled>
        Loading...
      </button>
    )
  }

  return (
    <WalletMultiButton
      className={buttonClass}
      startIcon={undefined} // Remove default icon if desired
    >
      {label || (connected ? 'Wallet' : 'Connect Wallet')}
    </WalletMultiButton>
  )
} 