import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { upsertSnapshot, deleteSnapshot } from '@/lib/db/cash_accounts'

export const dynamic = 'force-dynamic'

// POST — upsert one or many snapshots (accepts array or single object)
export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const items: Array<{ account_id: string; quarter: string; balance: number; notes?: string }> =
    Array.isArray(body) ? body : [body]

  if (items.length === 0) {
    return NextResponse.json({ snapshots: [] })
  }

  const snapshots = await Promise.all(
    items.map((item) =>
      upsertSnapshot(supabase, {
        account_id: item.account_id,
        quarter: item.quarter,
        balance: Number(item.balance),
        notes: item.notes,
      }),
    ),
  )

  return NextResponse.json({ snapshots })
}

export async function DELETE(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

  await deleteSnapshot(supabase, id)
  return NextResponse.json({ ok: true })
}
