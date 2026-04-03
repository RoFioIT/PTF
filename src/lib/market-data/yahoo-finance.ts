// ============================================================
// Market Data — Yahoo Finance Provider
//
// Uses Yahoo Finance's public chart API (no API key required).
// Converts Google Finance symbols (EPA:MC, NASDAQ:AMZN) to Yahoo
// Finance tickers (MC.PA, AMZN) automatically.
// ============================================================

import type { MarketDataProvider, AssetIdentifierQuery, Quote, PricePoint } from './types'
import { MarketDataError } from './types'
import type { IdentifierType } from '@/types/database'

// Exchange suffix mapping: Google Finance exchange → Yahoo Finance suffix
const EXCHANGE_SUFFIX: Record<string, string> = {
  EPA: '.PA',    // Euronext Paris
  AMS: '.AS',    // Euronext Amsterdam
  ETR: '.DE',    // XETRA (Germany)
  LON: '.L',     // London Stock Exchange
  BIT: '.MI',    // Borsa Italiana (Milan)
  STO: '.ST',    // Stockholm
  VIE: '.VI',    // Vienna
  BRU: '.BR',    // Brussels
  LIS: '.LS',    // Lisbon
  OSL: '.OL',    // Oslo
  HEL: '.HE',    // Helsinki
  WSE: '.WA',    // Warsaw
  TSX: '.TO',    // Toronto
  ASX: '.AX',    // Australia
  NSE: '.NS',    // India NSE
  BSE: '.BO',    // India BSE
  TYO: '.T',     // Tokyo
  SHA: '.SS',    // Shanghai
  SHE: '.SZ',    // Shenzhen
  HKG: '.HK',    // Hong Kong
  SGX: '.SI',    // Singapore
  // US exchanges — no suffix
  NASDAQ: '',
  NYSE: '',
  NYSEARCA: '',
  BATS: '',
  AMEX: '',
}

/**
 * Convert a Google Finance symbol to a Yahoo Finance ticker.
 * Examples:
 *   EPA:MC       → MC.PA
 *   NASDAQ:AMZN  → AMZN
 *   LON:CSPX     → CSPX.L
 *   BIT:RACE     → RACE.MI
 */
export function googleToYahoo(googleSymbol: string): string | null {
  const parts = googleSymbol.split(':')
  if (parts.length !== 2) return null

  const [exchange, ticker] = parts
  const suffix = EXCHANGE_SUFFIX[exchange.toUpperCase()]

  if (suffix === undefined) return null  // unknown exchange
  return `${ticker}${suffix}`
}

/**
 * Fetch JSON from Yahoo Finance with a timeout.
 */
async function yahooFetch(url: string): Promise<Response> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 10_000)

  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        // Yahoo sometimes blocks without a User-Agent
        'User-Agent': 'Mozilla/5.0 (compatible; PTF-tracker/1.0)',
      },
    })
    return res
  } finally {
    clearTimeout(timeout)
  }
}

/**
 * fetchFxRate — returns how many units of `to` equal 1 unit of `from`.
 * e.g. fetchFxRate('USD', 'EUR') → ~0.92
 * Uses Yahoo Finance FX tickers like USDEUR=X.
 * Returns 1 if from === to, or if the fetch fails (safe fallback).
 */
export async function fetchFxRate(from: string, to: string): Promise<number> {
  if (from === to) return 1
  const ticker = `${from}${to}=X`
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?interval=1d&range=5d`

  try {
    const res = await yahooFetch(url)
    if (!res.ok) return 1
    const json = await res.json()
    const price: number | undefined = json?.chart?.result?.[0]?.meta?.regularMarketPrice
    return price && price > 0 ? price : 1
  } catch {
    return 1
  }
}

export class YahooFinanceProvider implements MarketDataProvider {
  readonly name = 'yahoo-finance'

  supportsIdentifierType(type: IdentifierType): boolean {
    return type === 'GOOGLE_SYMBOL' || type === 'TICKER'
  }

  private resolveYahooTicker(identifier: AssetIdentifierQuery): string {
    if (identifier.type === 'GOOGLE_SYMBOL') {
      const ticker = googleToYahoo(identifier.value)
      if (!ticker) {
        throw new MarketDataError(
          `Cannot convert Google symbol "${identifier.value}" to Yahoo ticker`,
          this.name,
          identifier
        )
      }
      return ticker
    }
    // Plain TICKER — assume US market (no suffix)
    return identifier.value
  }

  async getQuote(identifier: AssetIdentifierQuery): Promise<Quote> {
    const ticker = this.resolveYahooTicker(identifier)
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?interval=1d&range=5d`

    const res = await yahooFetch(url)
    if (!res.ok) {
      throw new MarketDataError(
        `Yahoo Finance returned ${res.status} for ${ticker}`,
        this.name,
        identifier
      )
    }

    const json = await res.json()
    const result = json?.chart?.result?.[0]
    if (!result) {
      throw new MarketDataError(`No data returned for ${ticker}`, this.name, identifier)
    }

    const meta = result.meta
    const price: number = meta.regularMarketPrice ?? meta.previousClose
    const currency: string = meta.currency ?? 'USD'

    return {
      price,
      currency,
      timestamp: new Date(meta.regularMarketTime * 1000),
      source: this.name,
      change: meta.regularMarketPrice - meta.previousClose,
      changePct: ((meta.regularMarketPrice - meta.previousClose) / meta.previousClose) * 100,
    }
  }

  /**
   * Fetch historical daily or monthly closing prices.
   * Yahoo Finance valid intervals: 1d, 1wk, 1mo
   */
  async getHistoricalPrices(
    identifier: AssetIdentifierQuery,
    from: string,
    to: string,
    interval: '1d' | '1wk' | '1mo' = '1mo'
  ): Promise<PricePoint[]> {
    const ticker = this.resolveYahooTicker(identifier)

    const fromTs = Math.floor(new Date(from).getTime() / 1000)
    const toTs = Math.floor(new Date(to).getTime() / 1000)

    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}` +
      `?interval=${interval}&period1=${fromTs}&period2=${toTs}&includePrePost=false`

    const res = await yahooFetch(url)
    if (!res.ok) {
      throw new MarketDataError(
        `Yahoo Finance returned ${res.status} for ${ticker}`,
        this.name,
        identifier
      )
    }

    const json = await res.json()
    const result = json?.chart?.result?.[0]
    if (!result) {
      throw new MarketDataError(`No historical data for ${ticker}`, this.name, identifier)
    }

    const timestamps: number[] = result.timestamp ?? []
    const closes: (number | null)[] = result.indicators?.quote?.[0]?.close ?? []
    const currency: string = result.meta?.currency ?? 'USD'

    const points: PricePoint[] = []
    for (let i = 0; i < timestamps.length; i++) {
      const close = closes[i]
      if (close === null || close === undefined || isNaN(close)) continue

      let date: string
      if (interval === '1mo') {
        // Yahoo monthly bar timestamps = last trading day of the PREVIOUS month.
        // e.g. timestamp Dec 27 carries January's closing price.
        // Shift to the next calendar month so the date belongs to the correct period.
        const d = new Date(timestamps[i] * 1000)
        const y = d.getUTCFullYear()
        const m = d.getUTCMonth() // 0-indexed
        const nextM = m === 11 ? 0 : m + 1
        const nextY = m === 11 ? y + 1 : y
        date = `${nextY}-${String(nextM + 1).padStart(2, '0')}-01`
      } else {
        date = new Date(timestamps[i] * 1000).toISOString().slice(0, 10)
      }

      points.push({ date, close, currency })
    }

    return points
  }
}
