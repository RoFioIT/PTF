import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  createShareGrant,
  vestShareGrant,
  lapseShareGrant,
  deleteShareGrant,
} from '@/lib/db/share_grants'

export const dynamic = 'force-dynamic'

// POST /api/share-grants — create a new grant
export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const { portfolio_id, asset_id, share_type, grant_date, granted_quantity, notes } = body

  if (!portfolio_id || !asset_id || !share_type || !grant_date || !granted_quantity) {
    return NextResponse.json({ error: 'portfolio_id, asset_id, share_type, grant_date, granted_quantity are required' }, { status: 400 })
  }

  // Auto-compute vesting_date = grant_date + 3 years
  const gd = new Date(grant_date)
  gd.setFullYear(gd.getFullYear() + 3)
  const vesting_date = gd.toISOString().slice(0, 10)

  try {
    const grant = await createShareGrant(supabase, {
      portfolio_id,
      asset_id,
      share_type,
      grant_date,
      vesting_date,
      granted_quantity: Number(granted_quantity),
      notes: notes ?? undefined,
    })
    return NextResponse.json({ grant })
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}

// PUT /api/share-grants — vest a grant (sets vesting_pct, creates BUY transaction)
export async function PUT(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const { id, vesting_pct } = body

  if (!id || vesting_pct === undefined || vesting_pct === null) {
    return NextResponse.json({ error: 'id and vesting_pct are required' }, { status: 400 })
  }
  if (vesting_pct < 0 || vesting_pct > 100) {
    return NextResponse.json({ error: 'vesting_pct must be 0–100' }, { status: 400 })
  }

  // Fetch the grant to get portfolio_id, asset_id, granted_quantity
  const { data: grant, error: fetchErr } = await supabase
    .from('share_grants')
    .select('*')
    .eq('id', id)
    .single()

  if (fetchErr || !grant) {
    return NextResponse.json({ error: 'Grant not found' }, { status: 404 })
  }
  if (grant.status !== 'unvested') {
    return NextResponse.json({ error: 'Only unvested grants can be vested' }, { status: 400 })
  }

  try {
    // 1. Update grant status
    const updatedGrant = await vestShareGrant(supabase, id, Number(vesting_pct))

    // 2. Create BUY transaction for vested shares at £0
    const vestedQty = Number(grant.granted_quantity) * (Number(vesting_pct) / 100)
    if (vestedQty > 0) {
      const today = new Date().toISOString().slice(0, 10)
      const { error: txErr } = await supabase
        .from('transactions')
        .insert({
          portfolio_id: grant.portfolio_id,
          asset_id: grant.asset_id,
          type: 'BUY',
          quantity: vestedQty,
          price: 0,
          fees: 0,
          currency: 'GBP',
          date: today,
          notes: `Vesting of ${grant.share_type} grant (${vesting_pct}%)`,
        })

      if (txErr) {
        return NextResponse.json({ error: `Grant vested but transaction failed: ${txErr.message}` }, { status: 500 })
      }
    }

    return NextResponse.json({ grant: updatedGrant })
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}

// PATCH /api/share-grants — lapse a grant
export async function PATCH(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const { id } = body
  if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 })

  try {
    const grant = await lapseShareGrant(supabase, id)
    return NextResponse.json({ grant })
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}

// DELETE /api/share-grants?id= — delete an unvested grant
export async function DELETE(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 })

  try {
    await deleteShareGrant(supabase, id)
    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}
