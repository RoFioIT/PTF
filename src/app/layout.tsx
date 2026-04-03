import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'PTF — Portfolio Tracker',
  description: 'Production-grade personal investment portfolio tracker for PEA & CTO accounts',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="fr" suppressHydrationWarning>
      <body>{children}</body>
    </html>
  )
}
