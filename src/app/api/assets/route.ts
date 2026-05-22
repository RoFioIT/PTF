import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAsset, resolveAssetByIdentifier } from '@/lib/db/assets'
import type { AssetType, IdentifierType } from '@/types/database'

const VALID_ASSET_TYPES: AssetType[] = ['stock', 'etf', 'crypto', 'bond', 'other']

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { name, asset_type, currency, sector, country, isin, ticker } = body as {
    name?: string
    asset_type?: string
    currency?: string
    sector?: string
    country?: string
    isin?: string
    ticker?: string
  }

  if (!name || typeof name !== 'string' || name.trim().length === 0) {
    return NextResponse.json({ error: 'name is required' }, { status: 400 })
  }
  if (!asset_type || !VALID_ASSET_TYPES.includes(asset_type as AssetType)) {
    return NextResponse.json({ error: 'asset_type must be one of: stock, etf, crypto, bond, other' }, { status: 400 })
  }
  if (!currency || typeof currency !== 'string') {
    return NextResponse.json({ error: 'currency is required' }, { status: 400 })
  }

  // Guard against duplicate ISIN
  if (isin) {
    const existing = await resolveAssetByIdentifier(supabase, 'ISIN', isin.toUpperCase())
    if (existing) {
      return NextResponse.json({ error: 'An asset with this ISIN already exists', asset_id: existing.id }, { status: 409 })
    }
  }

  const identifiers: { type: IdentifierType; value: string }[] = []
  if (isin) identifiers.push({ type: 'ISIN', value: isin.toUpperCase() })
  if (ticker) identifiers.push({ type: 'TICKER', value: ticker.toUpperCase() })

  try {
    const asset = await createAsset(
      supabase,
      {
        name: name.trim(),
        asset_type: asset_type as AssetType,
        currency: currency.toUpperCase().trim(),
        sector: sector?.trim() || undefined,
        country: country?.trim() || undefined,
      },
      identifiers
    )
    return NextResponse.json({ asset }, { status: 201 })
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}
