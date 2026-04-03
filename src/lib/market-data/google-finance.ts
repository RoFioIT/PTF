// ============================================================
// Market Data — Google Finance Adapter (skeleton)
//
// Google Finance does not offer an official API.
// This adapter is designed to be filled in with:
//   a) A scraping approach (e.g. Cheerio parsing of finance.google.com)
//   b) A third-party wrapper that resolves Google Finance symbols
//   c) An alternative provider that accepts Google's symbol format
//      (e.g. "EPA:MC", "NASDAQ:AAPL")
//
// DO NOT call this in production until a reliable data source is wired in.
// ============================================================

import type { MarketDataProvider, AssetIdentifierQuery, Quote, PricePoint } from './types'
import { MarketDataError } from './types'
import type { IdentifierType } from '@/types/database'

export class GoogleFinanceProvider implements MarketDataProvider {
  readonly name = 'google-finance'

  /**
   * Google Finance symbols use "EXCHANGE:TICKER" format, e.g.:
   *   EPA:MC    → LVMH on Euronext Paris
   *   NASDAQ:AAPL → Apple on NASDAQ
   *   ETR:SAP   → SAP on XETRA
   */
  supportsIdentifierType(type: IdentifierType): boolean {
    return type === 'GOOGLE_SYMBOL' || type === 'TICKER'
  }

  async getQuote(identifier: AssetIdentifierQuery): Promise<Quote> {
    // TODO: implement once a reliable data source is identified.
    // Options:
    //   1. Parse https://finance.google.com/finance?q=EPA:MC (rate-limited, fragile)
    //   2. Use a third-party API that speaks Google symbols (e.g. financialmodelingprep.com)
    //   3. Use Yahoo Finance as a bridge (yfinance library, server-side only)

    const parsed = this.parseSymbol(identifier.value)
    void parsed // will be used in real implementation

    throw new MarketDataError(
      'Google Finance adapter is not yet implemented. Wire in a data source.',
      this.name,
      identifier
    )
  }

  async getHistoricalPrices(
    identifier: AssetIdentifierQuery,
    from: string,
    to: string
  ): Promise<PricePoint[]> {
    // TODO: implement — same options as getQuote above.
    void from
    void to

    throw new MarketDataError(
      'Google Finance historical prices not yet implemented.',
      this.name,
      identifier
    )
  }

  /**
   * Parse a Google Finance symbol into exchange + ticker.
   * "EPA:MC" → { exchange: "EPA", ticker: "MC" }
   */
  private parseSymbol(symbol: string): { exchange: string; ticker: string } | null {
    const parts = symbol.split(':')
    if (parts.length !== 2) return null
    return { exchange: parts[0], ticker: parts[1] }
  }

  /**
   * Normalize an exchange code to a standard market identifier.
   * Useful when bridging to providers that use different conventions.
   */
  static normalizeExchange(googleExchange: string): string {
    const map: Record<string, string> = {
      EPA: 'XPAR',   // Euronext Paris
      ETR: 'XETR',   // XETRA (Germany)
      LON: 'XLON',   // London Stock Exchange
      BIT: 'XMIL',   // Borsa Italiana
      AMS: 'XAMS',   // Euronext Amsterdam
      NASDAQ: 'XNAS',
      NYSE: 'XNYS',
    }
    return map[googleExchange] ?? googleExchange
  }
}

// ── Mock Provider (for development / tests) ───────────────────

/**
 * MockMarketDataProvider — returns deterministic fake prices.
 * Register this in non-production environments to develop UI
 * without hitting real APIs.
 */
export class MockMarketDataProvider implements MarketDataProvider {
  readonly name = 'mock'

  private readonly prices: Record<string, number>

  constructor(prices: Record<string, number> = {}) {
    this.prices = prices
  }

  supportsIdentifierType(_type: IdentifierType): boolean {
    return true  // accepts all identifier types in mock mode
  }

  async getQuote(identifier: AssetIdentifierQuery): Promise<Quote> {
    const price = this.prices[identifier.value] ?? this.generateFakePrice(identifier.value)

    return {
      price,
      currency: 'EUR',
      timestamp: new Date(),
      source: 'mock',
      change: price * 0.01 * (Math.random() - 0.5),
      changePct: (Math.random() - 0.5) * 2,
    }
  }

  async getHistoricalPrices(
    identifier: AssetIdentifierQuery,
    from: string,
    to: string
  ): Promise<PricePoint[]> {
    const basePrice = this.prices[identifier.value] ?? this.generateFakePrice(identifier.value)
    const points: PricePoint[] = []
    const current = new Date(from)
    const end = new Date(to)

    let price = basePrice * 0.8  // start below current price

    while (current <= end) {
      // Random walk
      price = price * (1 + (Math.random() - 0.48) * 0.02)
      points.push({
        date: current.toISOString().slice(0, 10),
        close: Math.round(price * 100) / 100,
        currency: 'EUR',
      })
      current.setDate(current.getDate() + 1)
    }

    return points
  }

  /** Deterministic fake price derived from the symbol string */
  private generateFakePrice(symbol: string): number {
    const seed = symbol.split('').reduce((acc, ch) => acc + ch.charCodeAt(0), 0)
    return 10 + (seed % 490)  // range 10–500
  }
}
