import type { Metadata } from 'next'
import { Instrument_Sans } from 'next/font/google'
import './globals.css'

const instrument = Instrument_Sans({ subsets: ['latin'], variable: '--font-instrument', display: 'swap' })

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
      <body className={instrument.variable}>{children}</body>
    </html>
  )
}
