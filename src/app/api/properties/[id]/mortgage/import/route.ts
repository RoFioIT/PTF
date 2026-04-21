import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { batchInsertPayments } from '@/lib/db/mortgages'
import type { InsertPaymentRow } from '@/lib/db/mortgages'

export const dynamic = 'force-dynamic'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  await params // property id available for ownership check (RLS enforces it)
  const body = await request.json()
  const { mortgageId, rows } = body as { mortgageId: string; rows: InsertPaymentRow[] }

  if (!mortgageId) return NextResponse.json({ error: 'Missing mortgageId' }, { status: 400 })
  if (!Array.isArray(rows) || rows.length === 0) {
    return NextResponse.json({ error: 'rows must be a non-empty array' }, { status: 400 })
  }

  await batchInsertPayments(supabase, mortgageId, rows)
  return NextResponse.json({ imported: rows.length })
}
