import './globals.css'
import type { Metadata } from 'next'
import { Providers } from './providers'
import { Navbar } from '@/components/navbar'
import { AppErrorBoundary } from '@/components/app-error-boundary'
import { Toaster } from 'sonner'
import { Sidebar } from '@/components/sidebar'

export const metadata: Metadata = {
  title: 'Academy Interview Assistant',
  description: 'AI-powered interview feedback automation for Lever ATS',
  icons: {
    icon: '/Academy Favicon White.png',
  },
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
      <body className="font-sans bg-background text-foreground antialiased">
        <Providers>
          <AppErrorBoundary>
            <div className="flex h-screen bg-background overflow-hidden">
              <Sidebar />
              <div className="md:hidden">
                <Navbar />
              </div>
              <main className="flex-1 overflow-auto relative flex flex-col w-full">
                {children}
              </main>
            </div>
            <Toaster position="bottom-right" theme="system" richColors closeButton />
          </AppErrorBoundary>
        </Providers>
      </body>
    </html>
  )
}
