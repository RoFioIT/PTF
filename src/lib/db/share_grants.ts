import type { SupabaseClient } from '@supabase/supabase-js'
import type { ShareGrant } from '@/types/database'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Client = SupabaseClient<any>

export interface CreateShareGrantInput {
  portfolio_id: string
  asset_id: string
  share_type: 'AFSS' | 'DFSS'
  grant_date: string       // YYYY-MM-DD
  vesting_date: string     // YYYY-MM-DD (computed by API = grant_date + 3 years)
  granted_quantity: number
  notes?: string
}

export async function getShareGrants(
  client: Client,
  portfolioId: string
): Promise<ShareGrant[]> {
  const { data, error } = await client
    .from('share_grants')
    .select('*')
    .eq('portfolio_id', portfolioId)
    .order('grant_date', { ascending: true })

  if (error) throw new Error(`getShareGrants: ${error.message}`)
  return data ?? []
}

export async function createShareGrant(
  client: Client,
  input: CreateShareGrantInput
): Promise<ShareGrant> {
  const { data, error } = await client
    .from('share_grants')
    .insert(input)
    .select()
    .single()

  if (error) throw new Error(`createShareGrant: ${error.message}`)
  return data
}

export async function vestShareGrant(
  client: Client,
  grantId: string,
  vestingPct: number
): Promise<ShareGrant> {
  const { data, error } = await client
    .from('share_grants')
    .update({ status: 'vested', vesting_pct: vestingPct })
    .eq('id', grantId)
    .select()
    .single()

  if (error) throw new Error(`vestShareGrant: ${error.message}`)
  return data
}

export async function lapseShareGrant(
  client: Client,
  grantId: string
): Promise<ShareGrant> {
  const { data, error } = await client
    .from('share_grants')
    .update({ status: 'lapsed' })
    .eq('id', grantId)
    .select()
    .single()

  if (error) throw new Error(`lapseShareGrant: ${error.message}`)
  return data
}

export async function deleteShareGrant(
  client: Client,
  grantId: string
): Promise<void> {
  const { error } = await client
    .from('share_grants')
    .delete()
    .eq('id', grantId)
    .eq('status', 'unvested') // safety: can only delete unvested grants

  if (error) throw new Error(`deleteShareGrant: ${error.message}`)
}
