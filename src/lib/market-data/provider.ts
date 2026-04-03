// ============================================================
// Market Data — Provider Registry
//
// Centralizes all provider registration and query routing.
// Providers are tried in priority order; the first one that
// supports the identifier type is used.
//
// Usage:
//   import { marketDataRegistry } from '@/lib/market-data/provider'
//   import { GoogleFinanceProvider } from '@/lib/market-data/google-finance'
//
//   marketDataRegistry.register(new GoogleFinanceProvider(), { priority: 1 })
//   const quote = await marketDataRegistry.getQuote({ type: 'GOOGLE_SYMBOL', value: 'EPA:MC' })
// ============================================================

import type {
  MarketDataProvider,
  AssetIdentifierQuery,
  Quote,
  PricePoint,
} from './types'
import { NoProviderError } from './types'
import type { IdentifierType } from '@/types/database'

interface RegisteredProvider {
  provider: MarketDataProvider
  priority: number   // lower = higher priority
}

class MarketDataRegistry {
  private providers: RegisteredProvider[] = []

  /**
   * Register a provider.
   * @param provider  The adapter instance
   * @param options   Registration options (priority, default = 100)
   */
  register(provider: MarketDataProvider, options: { priority?: number } = {}): void {
    this.providers.push({
      provider,
      priority: options.priority ?? 100,
    })
    // Keep sorted by priority ascending (lowest number = highest priority)
    this.providers.sort((a, b) => a.priority - b.priority)
  }

  /**
   * Unregister a provider by name.
   */
  unregister(name: string): void {
    this.providers = this.providers.filter((p) => p.provider.name !== name)
  }

  /**
   * Resolve the first provider that supports the identifier type.
   * Throws NoProviderError if none found.
   */
  private resolve(identifierType: IdentifierType): MarketDataProvider {
    const registered = this.providers.find((p) =>
      p.provider.supportsIdentifierType(identifierType)
    )
    if (!registered) {
      throw new NoProviderError({ type: identifierType, value: '?' })
    }
    return registered.provider
  }

  /**
   * Fetch a live quote.
   * Automatically selects the highest-priority compatible provider.
   */
  async getQuote(identifier: AssetIdentifierQuery): Promise<Quote> {
    const provider = this.resolve(identifier.type)
    return provider.getQuote(identifier)
  }

  /**
   * Fetch historical prices.
   */
  async getHistoricalPrices(
    identifier: AssetIdentifierQuery,
    from: string,
    to: string
  ): Promise<PricePoint[]> {
    const provider = this.resolve(identifier.type)
    return provider.getHistoricalPrices(identifier, from, to)
  }

  /**
   * Try all compatible providers in order, returning the first success.
   * Useful as a fallback strategy when data quality varies.
   */
  async getQuoteWithFallback(identifier: AssetIdentifierQuery): Promise<Quote> {
    const compatible = this.providers.filter((p) =>
      p.provider.supportsIdentifierType(identifier.type)
    )

    let lastError: Error | null = null

    for (const { provider } of compatible) {
      try {
        return await provider.getQuote(identifier)
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err))
        // Try next provider
      }
    }

    throw lastError ?? new NoProviderError(identifier)
  }

  listProviders(): string[] {
    return this.providers.map((p) => `${p.provider.name} (priority: ${p.priority})`)
  }
}

// Singleton registry — import this in your app code
export const marketDataRegistry = new MarketDataRegistry()
