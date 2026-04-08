// ============================================================
// Market Data — Yahoo Finance Provider
//
// Uses the `yahoo-finance2` npm package which handles the
// crumb/cookie authentication required since 2023.
// Converts Google Finance symbols (EPA:MC, NASDAQ:AMZN) to Yahoo
// Finance tickers (MC.PA, AMZN) automatically.
// ============================================================

import YahooFinance from 'yahoo-finance2'
const yahooFinance = new YahooFinance()
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
 * fetchFxRate — returns how many units of `to` equal 1 unit of `from`.
 * e.g. fetchFxRate('USD', 'EUR') → ~0.92
 * Returns 1 if from === to, or if the fetch fails (safe fallback).
 */
export async function fetchFxRate(from: string, to: string): Promise<number> {
  if (from === to) return 1
  const ticker = `${from}${to}=X`

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const quote: any = await yahooFinance.quote(ticker)
    const price = quote?.regularMarketPrice
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

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const quote: any = await yahooFinance.quote(ticker)

      const price: number = quote?.regularMarketPrice ?? quote?.previousClose ?? 0
      const currency: string = quote?.currency ?? 'USD'
      const prevClose: number = quote?.regularMarketPreviousClose ?? quote?.previousClose ?? price

      return {
        price,
        currency,
        timestamp: quote?.regularMarketTime ? new Date(quote.regularMarketTime) : new Date(),
        source: this.name,
        change: price - prevClose,
        changePct: prevClose !== 0 ? ((price - prevClose) / prevClose) * 100 : 0,
      }
    } catch (err) {
      throw new MarketDataError(
        err instanceof Error ? err.message : String(err),
        this.name,
        identifier
      )
    }
  }

  /**
   * Fetch historical monthly closing prices using yahoo-finance2.
   */
  async getHistoricalPrices(
    identifier: AssetIdentifierQuery,
    from: string,
    to: string,
    interval: '1d' | '1wk' | '1mo' = '1mo'
  ): Promise<PricePoint[]> {
    const ticker = this.resolveYahooTicker(identifier)

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result: any = await yahooFinance.chart(ticker, {
        period1: from,
        period2: to,
        interval,
      })

      const quotes: any[] = result?.quotes ?? []
      const currency: string = result?.meta?.currency ?? 'USD'

      const points: PricePoint[] = []
      for (const q of quotes) {
        const close = q.close
        if (close === null || close === undefined || isNaN(close)) continue

        let date: string
        if (interval === '1mo') {
          // Yahoo monthly bar timestamps = last trading day of the PREVIOUS month.
          // Shift forward one month so the date belongs to the correct period.
          const d = new Date(q.date)
          const y = d.getUTCFullYear()
          const m = d.getUTCMonth() // 0-indexed
          const nextM = m === 11 ? 0 : m + 1
          const nextY = m === 11 ? y + 1 : y
          date = `${nextY}-${String(nextM + 1).padStart(2, '0')}-01`
        } else {
          date = new Date(q.date).toISOString().slice(0, 10)
        }

        points.push({ date, close, currency })
      }

      return points
    } catch (err) {
      throw new MarketDataError(
        err instanceof Error ? err.message : String(err),
        this.name,
        identifier
      )
    }
  }
}
