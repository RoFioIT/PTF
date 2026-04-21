// ============================================================
// DB Layer — Mortgages + Mortgage Payments
// ============================================================

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Mortgage, MortgagePayment } from '@/types/database'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Client = SupabaseClient<any>

export interface CreateMortgageInput {
  property_id: string
  bank_name: string
  start_date: string
  initial_amount: number
  notes?: string | null
}

export interface UpdateMortgageInput {
  bank_name?: string
  start_date?: string
  initial_amount?: number
  notes?: string | null
}

export interface InsertPaymentRow {
  month_number: number
  payment_date: string
  total_payment: number
  principal: number
  interest: number
  insurance: number
  remaining_balance: number
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toMortgage(row: any): Mortgage {
  return {
    ...row,
    initial_amount: Number(row.initial_amount),
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toPayment(row: any): MortgagePayment {
  return {
    ...row,
    total_payment: Number(row.total_payment),
    principal: Number(row.principal),
    interest: Number(row.interest),
    insurance: Number(row.insurance),
    remaining_balance: Number(row.remaining_balance),
  }
}

// ── Mortgage CRUD ─────────────────────────────────────────────

export async function getMortgageByProperty(
  client: Client,
  propertyId: string
): Promise<Mortgage | null> {
  const { data, error } = await client
    .from('mortgages')
    .select('*')
    .eq('property_id', propertyId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) throw new Error(`getMortgageByProperty: ${error.message}`)
  return data ? toMortgage(data) : null
}

export async function createMortgage(
  client: Client,
  input: CreateMortgageInput
): Promise<Mortgage> {
  const { data, error } = await client
    .from('mortgages')
    .insert(input)
    .select()
    .single()

  if (error) throw new Error(`createMortgage: ${error.message}`)
  return toMortgage(data)
}

export async function updateMortgage(
  client: Client,
  id: string,
  updates: UpdateMortgageInput
): Promise<Mortgage> {
  const { data, error } = await client
    .from('mortgages')
    .update(updates)
    .eq('id', id)
    .select()
    .single()

  if (error) throw new Error(`updateMortgage: ${error.message}`)
  return toMortgage(data)
}

export async function deleteMortgage(client: Client, id: string): Promise<void> {
  const { error } = await client.from('mortgages').delete().eq('id', id)
  if (error) throw new Error(`deleteMortgage: ${error.message}`)
}

// ── Mortgage Payments ─────────────────────────────────────────

export async function getPaymentsByMortgage(
  client: Client,
  mortgageId: string
): Promise<MortgagePayment[]> {
  const { data, error } = await client
    .from('mortgage_payments')
    .select('*')
    .eq('mortgage_id', mortgageId)
    .order('month_number', { ascending: true })

  if (error) throw new Error(`getPaymentsByMortgage: ${error.message}`)
  return (data ?? []).map(toPayment)
}

/**
 * getRemainingBalance — returns the remaining_balance of the last payment
 * whose payment_date <= asOfDate. Returns null if no payments have been
 * made yet (caller should fall back to mortgage.initial_amount).
 */
export async function getRemainingBalance(
  client: Client,
  mortgageId: string,
  asOfDate: string
): Promise<number | null> {
  const { data, error } = await client
    .from('mortgage_payments')
    .select('remaining_balance')
    .eq('mortgage_id', mortgageId)
    .lte('payment_date', asOfDate)
    .order('payment_date', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) throw new Error(`getRemainingBalance: ${error.message}`)
  return data ? Number(data.remaining_balance) : null
}

/**
 * batchInsertPayments — replaces all existing rows for this mortgage
 * with the new set (full reimport).
 */
export async function batchInsertPayments(
  client: Client,
  mortgageId: string,
  rows: InsertPaymentRow[]
): Promise<void> {
  if (rows.length === 0) return

  // Delete existing rows first
  const { error: delError } = await client
    .from('mortgage_payments')
    .delete()
    .eq('mortgage_id', mortgageId)

  if (delError) throw new Error(`batchInsertPayments (delete): ${delError.message}`)

  const inserts = rows.map((r) => ({ ...r, mortgage_id: mortgageId }))

  const { error: insError } = await client
    .from('mortgage_payments')
    .insert(inserts)

  if (insError) throw new Error(`batchInsertPayments (insert): ${insError.message}`)
}
