'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Menu, X, Sword } from 'lucide-react' // Sword as a thematic icon
import Link from 'next/link'
import { SolanaWalletButton } from './SolanaWalletButton'
import { useWallet } from '@solana/wallet-adapter-react'

export function Navigation() {
  const [isOpen, setIsOpen] = useState(false)
  const { connected } = useWallet()
  const toggleMenu = () => setIsOpen(!isOpen)
  const navLinks = connected
    ? [
      { href: '/', label: 'Home' },
      { href: '/shop', label: 'Shop' },
      { href: '/about', label: 'About' },
    ]
    : [
      { href: '/', label: 'Home' },
      { href: '/about', label: 'About' },
    ]
  return (
    <nav className="fixed w-full bg-black/80 backdrop-blur-sm z-50 border-b border-gray-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo/Brand */}
          <div className="flex items-center">
            <Link href="/" className="flex items-center space-x-2">
              <Sword className="h-8 w-8 text-purple-400" />{' '}
              {/* Thematic icon */}
              <span className="font-bold text-xl text-white">
                Automythic AI
              </span>
            </Link>
          </div>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center space-x-6">
            {navLinks.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="text-gray-400 hover:text-white transition-colors"
              >
                {item.label}
              </Link>
            ))}

            <Link href="/adventures/new">
              <Button variant="outline" className="border-indigo-400/50">
                Create Adventure
              </Button>
            </Link>
            <SolanaWalletButton />
          </div>

          {/* Mobile Menu Button */}
          <div className="md:hidden">
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleMenu}
              className="text-gray-400 bg-transparent hover:bg-transparent hover:text-white"
            >
              {isOpen ? (
                <X className="h-6 w-6" />
              ) : (
                <Menu className="h-6 w-6" />
              )}
            </Button>
          </div>
        </div>
      </div>

      {/* Mobile Navigation */}
      {isOpen && (
        <div className="md:hidden">
          <div className="px-2 pt-2 pb-3 space-y-1 bg-black border-b border-gray-800">
            {navLinks.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="block px-3 py-2 rounded-md text-base font-medium text-gray-400 hover:text-white hover:bg-gray-800"
              >
                {item.label}
              </Link>
            ))}

            <Link
              href="/adventures/new"
              className="block px-3 py-2 rounded-md text-base font-medium"
            >
              <Button variant="outline" className="w-full border-indigo-400/50">
                Create Adventure
              </Button>
            </Link>
            <div className="px-3 py-2">
              <SolanaWalletButton className="w-full" />
            </div>
          </div>
        </div>
      )}
    </nav>
  )
}
