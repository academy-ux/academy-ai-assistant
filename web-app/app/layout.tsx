import './globals.css'
import type { Metadata } from 'next'
import { Inter, Playfair_Display, Space_Grotesk } from 'next/font/google'
import { Providers } from './providers'
import { Navbar } from '@/components/navbar'

const inter = Inter({ subsets: ['latin'], variable: '--font-sans' })
const playfair = Playfair_Display({ subsets: ['latin'], variable: '--font-serif' })
const spaceGrotesk = Space_Grotesk({ subsets: ['latin'], variable: '--font-grotesk' })

export const metadata: Metadata = {
  title: 'Academy Interview Assistant',
  description: 'AI-powered interview feedback automation for Lever ATS',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <head>
        <link rel="stylesheet" href="https://use.typekit.net/piz1fwl.css" />
      </head>
      <body className={`${inter.variable} ${playfair.variable} ${spaceGrotesk.variable} font-sans bg-background text-foreground antialiased`}>
        <Providers>
          <div className="min-h-screen flex flex-col">
            <Navbar />
            <main className="flex-1">
              {children}
            </main>
          </div>
        </Providers>
      </body>
    </html>
  )
}
