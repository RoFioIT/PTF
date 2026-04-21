// ============================================================
// Database types — hand-written to match 001_schema.sql
// Run `npx supabase gen types typescript` to regenerate after schema changes.
// ============================================================

export type PortfolioType = 'PEA' | 'CTO' | 'ADM'
export type AccountingMethod = 'PRU' | 'FIFO'
export type ShareGrantStatus = 'unvested' | 'vested' | 'lapsed'
export type AssetType = 'stock' | 'etf' | 'crypto' | 'bond' | 'other'
export type IdentifierType = 'ISIN' | 'TICKER' | 'GOOGLE_SYMBOL' | 'BOURSORAMA' | 'OTHER'
export type TransactionType = 'BUY' | 'SELL'
export type CashMovementType = 'DEPOSIT' | 'WITHDRAWAL' | 'TRANSFER_IN' | 'TRANSFER_OUT'

export interface Portfolio {
  id: string
  user_id: string
  name: string
  type: PortfolioType
  base_currency: string
  accounting_method: AccountingMethod
  description: string | null
  created_at: string
  updated_at: string
}

export interface Asset {
  id: string
  name: string
  asset_type: AssetType
  currency: string
  sector: string | null
  country: string | null
  created_at: string
}

export interface AssetIdentifier {
  id: string
  asset_id: string
  type: IdentifierType
  value: string
}

export interface AssetPrice {
  id: string
  asset_id: string
  price: number
  currency: string
  date: string // ISO date string 'YYYY-MM-DD'
  source: string | null
}

export interface Transaction {
  id: string
  portfolio_id: string
  asset_id: string
  type: TransactionType
  quantity: number
  price: number
  fees: number
  currency: string
  date: string // ISO date string 'YYYY-MM-DD'
  notes: string | null
  created_at: string
}

export interface Dividend {
  id: string
  portfolio_id: string
  asset_id: string
  amount: number
  tax: number
  currency: string
  date: string
  notes: string | null
  created_at: string
}

export interface CashMovement {
  id: string
  portfolio_id: string
  type: CashMovementType
  amount: number
  currency: string
  date: string
  notes: string | null
  created_at: string
}

export interface ShareGrant {
  id: string
  portfolio_id: string
  asset_id: string
  share_type: 'AFSS' | 'DFSS'
  grant_date: string
  vesting_date: string
  granted_quantity: number
  vesting_pct: number | null
  status: ShareGrantStatus
  notes: string | null
  created_at: string
}

export interface CashAccount {
  id: string
  user_id: string
  owner: string
  category: string
  name: string
  currency: string
  is_active: boolean
  notes: string | null
  created_at: string
  updated_at: string
}

export interface CashAccountSnapshot {
  id: string
  account_id: string
  quarter: string   // 'YYYY-QN'
  balance: number
  notes: string | null
  created_at: string
}

// ── Budget Tracker ──────────────────────────────────────────────
export type BudgetCategoryType = 'income' | 'savings' | 'expense'

export interface BudgetCategory {
  id: string
  user_id: string
  name: string
  type: BudgetCategoryType
  sort_order: number
  created_at: string
}

export interface BudgetItem {
  id: string
  user_id: string
  category_id: string
  name: string
  sort_order: number
  is_active: boolean
  created_at: string
}

export interface BudgetEntry {
  id: string
  item_id: string
  year: number
  month: number
  budget: number
  actual: number | null
  created_at: string
  updated_at: string
}

// ── Real Estate / Properties ────────────────────────────────────
export type PropertyType    = 'home' | 'investment'
export type PropertyCountry = 'france' | 'italy'

export interface Property {
  id: string
  user_id: string
  name: string
  type: PropertyType
  country: PropertyCountry
  address: string | null
  current_value: number
  purchase_price: number | null
  purchase_date: string | null  // 'YYYY-MM-DD'
  notes: string | null
  created_at: string
  updated_at: string
}

export interface Mortgage {
  id: string
  property_id: string
  bank_name: string
  start_date: string      // 'YYYY-MM-DD'
  initial_amount: number
  notes: string | null
  created_at: string
  updated_at: string
}

export interface MortgagePayment {
  id: string
  mortgage_id: string
  month_number: number
  payment_date: string    // 'YYYY-MM-DD'
  total_payment: number
  principal: number
  interest: number
  insurance: number
  remaining_balance: number
}

export interface PropertyWithMortgage extends Property {
  mortgage: Mortgage | null
}

// Joined/enriched types used in the UI
export interface TransactionWithAsset extends Transaction {
  asset: Asset
}

export interface DividendWithAsset extends Dividend {
  asset: Asset
}

export interface AssetWithIdentifiers extends Asset {
  asset_identifiers: AssetIdentifier[]
}

// Supabase Database shape (for createClient<Database> generic)
// Matches the structure expected by @supabase/supabase-js v2.
export type Database = {
  public: {
    Tables: {
      portfolios: {
        Row: Portfolio
        Insert: Omit<Portfolio, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<Portfolio, 'id' | 'user_id' | 'created_at' | 'updated_at'>>
        Relationships: []
      }
      assets: {
        Row: Asset
        Insert: Omit<Asset, 'id' | 'created_at'>
        Update: Partial<Omit<Asset, 'id' | 'created_at'>>
        Relationships: []
      }
      asset_identifiers: {
        Row: AssetIdentifier
        Insert: Omit<AssetIdentifier, 'id'>
        Update: Partial<Omit<AssetIdentifier, 'id' | 'asset_id'>>
        Relationships: []
      }
      asset_prices: {
        Row: AssetPrice
        Insert: Omit<AssetPrice, 'id'>
        Update: Partial<Omit<AssetPrice, 'id' | 'asset_id'>>
        Relationships: []
      }
      transactions: {
        Row: Transaction
        Insert: Omit<Transaction, 'id' | 'created_at'>
        Update: Partial<Omit<Transaction, 'id' | 'portfolio_id' | 'asset_id' | 'created_at'>>
        Relationships: []
      }
      dividends: {
        Row: Dividend
        Insert: Omit<Dividend, 'id' | 'created_at'>
        Update: Partial<Omit<Dividend, 'id' | 'portfolio_id' | 'asset_id' | 'created_at'>>
        Relationships: []
      }
      cash_movements: {
        Row: CashMovement
        Insert: Omit<CashMovement, 'id' | 'created_at'>
        Update: Partial<Omit<CashMovement, 'id' | 'portfolio_id' | 'created_at'>>
        Relationships: []
      }
      share_grants: {
        Row: ShareGrant
        Insert: Omit<ShareGrant, 'id' | 'created_at'>
        Update: Partial<Omit<ShareGrant, 'id' | 'portfolio_id' | 'asset_id' | 'created_at'>>
        Relationships: []
      }
      cash_accounts: {
        Row: CashAccount
        Insert: Omit<CashAccount, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<CashAccount, 'id' | 'user_id' | 'created_at' | 'updated_at'>>
        Relationships: []
      }
      cash_account_snapshots: {
        Row: CashAccountSnapshot
        Insert: Omit<CashAccountSnapshot, 'id' | 'created_at'>
        Update: Partial<Omit<CashAccountSnapshot, 'id' | 'account_id' | 'created_at'>>
        Relationships: []
      }
      budget_categories: {
        Row: BudgetCategory
        Insert: Omit<BudgetCategory, 'id' | 'created_at'>
        Update: Partial<Omit<BudgetCategory, 'id' | 'user_id' | 'created_at'>>
        Relationships: []
      }
      budget_items: {
        Row: BudgetItem
        Insert: Omit<BudgetItem, 'id' | 'created_at'>
        Update: Partial<Omit<BudgetItem, 'id' | 'user_id' | 'created_at'>>
        Relationships: []
      }
      budget_entries: {
        Row: BudgetEntry
        Insert: Omit<BudgetEntry, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<BudgetEntry, 'id' | 'item_id' | 'year' | 'month' | 'created_at' | 'updated_at'>>
        Relationships: []
      }
      properties: {
        Row: Property
        Insert: Omit<Property, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<Property, 'id' | 'user_id' | 'created_at' | 'updated_at'>>
        Relationships: []
      }
      mortgages: {
        Row: Mortgage
        Insert: Omit<Mortgage, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<Mortgage, 'id' | 'property_id' | 'created_at' | 'updated_at'>>
        Relationships: []
      }
      mortgage_payments: {
        Row: MortgagePayment
        Insert: Omit<MortgagePayment, 'id'>
        Update: Partial<Omit<MortgagePayment, 'id' | 'mortgage_id'>>
        Relationships: []
      }
    }
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: {
      portfolio_type: PortfolioType
      accounting_method: AccountingMethod
      asset_type: AssetType
      identifier_type: IdentifierType
      transaction_type: TransactionType
      cash_movement_type: CashMovementType
      property_type: PropertyType
      property_country: PropertyCountry
    }
    CompositeTypes: Record<string, never>
  }
}
