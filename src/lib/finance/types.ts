// ============================================================
// Finance Engine — Core Domain Types
// ============================================================
// These types are internal to the calculation engine and are
// intentionally decoupled from database row types so the engine
// can be tested independently of Supabase.
// ============================================================

/** A sorted (ascending by date) BUY or SELL event */
export interface FinTransaction {
  id: string
  assetId: string
  type: 'BUY' | 'SELL'
  quantity: number   // always positive
  price: number      // per-unit execution price (in portfolio base currency)
  fees: number       // total fees for this leg
  date: string       // ISO 'YYYY-MM-DD'
}

export interface FinDividend {
  id: string
  assetId: string
  amount: number     // gross amount
  tax: number        // withholding tax
  currency: string
  date: string
}

export interface FinCashMovement {
  type: 'DEPOSIT' | 'WITHDRAWAL' | 'TRANSFER_IN' | 'TRANSFER_OUT'
  amount: number
  date: string
}

export interface FinPricePoint {
  date: string
  price: number
}

// ── PRU (Prix de Revient Unitaire / Weighted Average Cost) ──

export interface PRUState {
  /** Current number of shares held */
  totalShares: number
  /** Weighted average cost per share (fees included in cost basis) */
  avgCostBasis: number
  /** Total fees paid on BUY transactions */
  totalFeesPaid: number
  /** Realized P&L from SELL transactions */
  realizedPnL: number
}

// ── FIFO ─────────────────────────────────────────────────────

export interface FIFOLot {
  quantity: number
  costBasis: number  // per-unit, fees included
  date: string
}

export interface FIFOState {
  lots: FIFOLot[]    // remaining open lots (oldest first)
  totalShares: number
  realizedPnL: number
  totalFeesPaid: number
}

// ── Computed Position (output of buildPosition) ───────────────

export interface Position {
  assetId: string
  /** Current shares held */
  totalShares: number
  /** Cost basis per share (accounting-method-dependent) */
  avgCostBasis: number
  /** Total capital deployed in this position (costBasis * shares) */
  totalInvested: number
  /** Current market value (totalShares * currentPrice) */
  currentValue: number
  /** Realised profit/loss from completed trades */
  realizedPnL: number
  /** Unrealised profit/loss based on current price */
  unrealizedPnL: number
  /** Total P&L = realized + unrealized */
  totalPnL: number
  /** Performance % relative to totalInvested */
  performancePct: number
  /** Most recent execution price used for this position */
  currentPrice: number
  /** Allocation weight — filled in by buildPortfolioSnapshot */
  allocationPct?: number
}

// ── Portfolio Snapshot ────────────────────────────────────────

export interface Allocation {
  assetId: string
  allocationPct: number
  currentValue: number
}

export interface PortfolioSnapshot {
  /** Sum of (avgCostBasis * shares) across all open positions */
  totalInvested: number
  /** Sum of current market values across all positions */
  currentValue: number
  /** realizedPnL + unrealizedPnL (all positions) */
  totalPnL: number
  /** totalPnL / totalInvested * 100 */
  performancePct: number
  /** Net cash deployed: deposits - withdrawals */
  netCashFlow: number
  positions: Position[]
  allocations: Allocation[]
}

// ── Historical Data Points ────────────────────────────────────

export interface HistoricalDataPoint {
  date: string
  value: number          // portfolio value in base currency
  invested: number       // cumulative invested capital
  cashFlow?: number      // cash flow on this date (deposit/withdrawal)
}
