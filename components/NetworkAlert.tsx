'use client'

import { useEffect, useState } from 'react'
import { useConnection, useWallet } from '@solana/wallet-adapter-react'
import { Connection } from '@solana/web3.js'
import { toast } from 'sonner'
import {
  CURRENT_NETWORK,
  SONIC_NETWORKS,
  SOLANA_NETWORKS_CONFIG
} from '@/lib/config'
import { AlertCircle, ExternalLink } from 'lucide-react'

type DetectedNetwork = {
  provider: 'sonic' | 'solana' | 'unknown';
  network: string;
  name: string;
}

export function NetworkAlert() {
  const { connection } = useConnection()
  const { connected, publicKey } = useWallet()
  const [isCorrectNetwork, setIsCorrectNetwork] = useState(true)
  const [mounted, setMounted] = useState(false)
  const [detectedNetwork, setDetectedNetwork] = useState<DetectedNetwork | null>(null)

  // Only run on client-side to prevent hydration errors
  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (!mounted || !connected || !publicKey) return

    const checkNetwork = async () => {
      try {
        // Get the genesis hash to identify the network
        const genesisHash = await connection.getGenesisHash()

        // Create a temporary connection to our expected network to compare
        const expectedConnection = new Connection(CURRENT_NETWORK.endpoint)
        const expectedGenesisHash = await expectedConnection.getGenesisHash()

        const onCorrectNetwork = genesisHash === expectedGenesisHash
        setIsCorrectNetwork(onCorrectNetwork)

        // If not on the correct network, try to determine which network they're on
        if (!onCorrectNetwork) {
          let detected: DetectedNetwork = {
            provider: 'unknown',
            network: 'unknown',
            name: 'Unknown Network'
          }

          // Check Sonic networks
          for (const [network, config] of Object.entries(SONIC_NETWORKS)) {
            try {
              const conn = new Connection(config.endpoint)
              const hash = await conn.getGenesisHash()
              if (genesisHash === hash) {
                detected = {
                  provider: 'sonic',
                  network,
                  name: config.name
                }
                break
              }
            } catch (e) {
              console.error(`Error checking Sonic ${network}:`, e)
            }
          }

          // Check regular Solana networks if not found yet
          if (detected.provider === 'unknown') {
            for (const [network, config] of Object.entries(SOLANA_NETWORKS_CONFIG)) {
              try {
                const conn = new Connection(config.endpoint)
                const hash = await conn.getGenesisHash()
                if (genesisHash === hash) {
                  detected = {
                    provider: 'solana',
                    network,
                    name: config.name
                  }
                  break
                }
              } catch (e) {
                console.error(`Error checking Solana ${network}:`, e)
              }
            }
          }

          setDetectedNetwork(detected)

          // Show a toast notification
          toast.error('Wrong Network Detected', {
            description: `You are connected to ${detected.name}. Please connect to ${CURRENT_NETWORK.name}.`,
            duration: 10000,
            id: 'network-error',
          })
        }
      } catch (error) {
        console.error('Error checking network:', error)
      }
    }

    checkNetwork()
  }, [connected, publicKey, connection, mounted])

  // Only render the alert banner if mounted, connected to a wallet, and on the wrong network
  if (!mounted || !connected || isCorrectNetwork) {
    return null
  }

  // Show a persistent banner for wrong network
  return (
    <div className="fixed top-16 left-0 right-0 z-50 bg-red-600 text-white py-2 px-4 flex items-center justify-center">
      <AlertCircle className="mr-2 h-5 w-5" />
      <span>
        Wrong network detected: {detectedNetwork?.name || 'Unknown Network'}.
        Please connect to <strong>{CURRENT_NETWORK.name}</strong> to use this app.
      </span>
      <a
        href={CURRENT_NETWORK.explorerUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="ml-2 flex items-center text-white underline"
      >
        Explorer <ExternalLink className="ml-1 h-3 w-3" />
      </a>
    </div>
  )
} 