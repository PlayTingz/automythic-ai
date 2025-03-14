'use client'

import { useEffect, useState } from 'react'
import { useConnection, useWallet } from '@solana/wallet-adapter-react'
import { Connection } from '@solana/web3.js'
import { CURRENT_NETWORK } from '@/lib/config'

export function WalletDebugInfo() {
  const { connection } = useConnection()
  const { connected, publicKey, wallet } = useWallet()
  const [mounted, setMounted] = useState(false)
  const [networkInfo, setNetworkInfo] = useState<{
    genesisHash: string;
    expectedHash: string;
    rpcEndpoint: string;
    walletName: string;
  }>({
    genesisHash: '',
    expectedHash: '',
    rpcEndpoint: '',
    walletName: '',
  })

  // Only run on client-side to prevent hydration errors
  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (!mounted || !connected || !publicKey) return

    const getNetworkInfo = async () => {
      try {
        // Get the genesis hash to identify the network
        const genesisHash = await connection.getGenesisHash()
        const rpcEndpoint = connection.rpcEndpoint

        // Create a temporary connection to our expected network to compare
        const expectedConnection = new Connection(CURRENT_NETWORK.endpoint)
        const expectedGenesisHash = await expectedConnection.getGenesisHash()

        setNetworkInfo({
          genesisHash,
          expectedHash: expectedGenesisHash,
          rpcEndpoint,
          walletName: wallet?.adapter.name || 'Unknown',
        })
      } catch (error) {
        console.error('Error getting network info:', error)
      }
    }

    getNetworkInfo()
  }, [connected, publicKey, connection, wallet, mounted])

  if (!mounted || !connected) {
    return null
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 bg-black/80 text-white p-4 rounded-lg text-xs max-w-xs">
      <h3 className="font-bold mb-2">Wallet Debug Info</h3>
      <div className="space-y-1">
        <p><span className="font-semibold">Wallet:</span> {networkInfo.walletName}</p>
        <p><span className="font-semibold">RPC Endpoint:</span> {networkInfo.rpcEndpoint}</p>
        <p><span className="font-semibold">Genesis Hash:</span> {networkInfo.genesisHash.slice(0, 10)}...</p>
        <p><span className="font-semibold">Expected Hash:</span> {networkInfo.expectedHash.slice(0, 10)}...</p>
        <p><span className="font-semibold">Match:</span> {networkInfo.genesisHash === networkInfo.expectedHash ? '✅' : '❌'}</p>
      </div>
    </div>
  )
} 