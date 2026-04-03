// ============================================================
// DB Layer — Cash Movements
// ============================================================

// eslint-disable-next-line @typescript-eslint/no-explicit-any
import type { SupabaseClient } from '@supabase/supabase-js'
import type { CashMovement, CashMovementType } from '@/types/database'
import type { FinCashMovement } from '@/lib/finance/types'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Client = SupabaseClient<any>

export interface CreateCashMovementInput {
  portfolio_id: string
  type: CashMovementType
  amount: number
  currency?: string
  date: string
  notes?: string
}

export async function getCashMovementsByPortfolio(
  client: Client,
  portfolioId: string
): Promise<CashMovement[]> {
  const { data, error } = await client
    .from('cash_movements')
    .select('*')
    .eq('portfolio_id', portfolioId)
    .order('date', { ascending: true })

  if (error) throw new Error(`getCashMovementsByPortfolio: ${error.message}`)
  return data ?? []
}

export async function createCashMovement(
  client: Client,
  input: CreateCashMovementInput
): Promise<CashMovement> {
  const { data, error } = await client
    .from('cash_movements')
    .insert({
      portfolio_id: input.portfolio_id,
      type:         input.type,
      amount:       input.amount,
      currency:     input.currency ?? 'EUR',
      date:         input.date,
      notes:        input.notes ?? null,
    })
    .select()
    .single()

  if (error) throw new Error(`createCashMovement: ${error.message}`)
  return data
}

export async function deleteCashMovement(client: Client, id: string): Promise<void> {
  const { error } = await client.from('cash_movements').delete().eq('id', id)
  if (error) throw new Error(`deleteCashMovement: ${error.message}`)
}

export function toFinCashMovement(mv: CashMovement): FinCashMovement {
  return {
    type:   mv.type,
    amount: Number(mv.amount),
    date:   mv.date,
  }
}
