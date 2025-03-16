import type { Metadata } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import './globals.css'
import { Toaster } from 'sonner'
import { NearProvider } from './providers'
import { Navigation } from '@/components/navigation'
import { NetworkAlert } from '@/components/NetworkAlert'
import { WalletDebugInfo } from '@/components/WalletDebugInfo'

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
})

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
})

export const metadata: Metadata = {
  title: 'Automythic AI - AI-Powered RPG Adventures on Sonic Blockchain',
  description:
    'Generate and play AI-powered RPG adventures on the Sonic blockchain. Create unique stories, own your characters as NFTs, and join a community of players.',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className="light">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <NearProvider>
          <Navigation />
          <NetworkAlert />
          {children}
          <WalletDebugInfo />
          <Toaster />
        </NearProvider>
      </body>
    </html>
  )
}
