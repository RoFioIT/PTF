// ============================================================
// Market Data Abstraction — Provider Interface
//
// Providers implement this interface. New data sources (Bloomberg,
// Yahoo Finance, Alpha Vantage, etc.) can be added without changing
// the rest of the application.
// ============================================================

import type { IdentifierType } from '@/types/database'

export interface AssetIdentifierQuery {
  type: IdentifierType
  value: string
}

/** A single price data point */
export interface PricePoint {
  date: string    // ISO 'YYYY-MM-DD'
  open?: number
  high?: number
  low?: number
  close: number   // closing price — the canonical price
  volume?: number
  currency: string
}

/** A real-time or delayed quote */
export interface Quote {
  price: number
  currency: string
  /** ISO timestamp of the quote */
  timestamp: Date
  /** Which provider supplied this data */
  source: string
  /** Optional bid/ask spread */
  bid?: number
  ask?: number
  /** Day change */
  change?: number
  changePct?: number
}

/** Abstract interface every market data adapter must implement */
export interface MarketDataProvider {
  readonly name: string

  /**
   * Fetch the latest quote for an asset.
   * @param identifier  The identifier to look up (ISIN, TICKER, GOOGLE_SYMBOL…)
   */
  getQuote(identifier: AssetIdentifierQuery): Promise<Quote>

  /**
   * Fetch historical daily closing prices.
   * @param identifier  The identifier to look up
   * @param from        Start date (inclusive), ISO 'YYYY-MM-DD'
   * @param to          End date (inclusive), ISO 'YYYY-MM-DD'
   */
  getHistoricalPrices(
    identifier: AssetIdentifierQuery,
    from: string,
    to: string
  ): Promise<PricePoint[]>

  /**
   * Check if this provider supports a given identifier type.
   * Used by the registry to select the right adapter.
   */
  supportsIdentifierType(type: IdentifierType): boolean
}

/** Error thrown when a provider cannot find or parse a quote */
export class MarketDataError extends Error {
  constructor(
    message: string,
    public readonly provider: string,
    public readonly identifier: AssetIdentifierQuery
  ) {
    super(message)
    this.name = 'MarketDataError'
  }
}

/** Error thrown when no provider supports the requested identifier */
export class NoProviderError extends Error {
  constructor(identifier: AssetIdentifierQuery) {
    super(
      `No market data provider supports identifier type "${identifier.type}" with value "${identifier.value}"`
    )
    this.name = 'NoProviderError'
  }
}
