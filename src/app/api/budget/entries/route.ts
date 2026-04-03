import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getBudgetEntries, getAvailableYears, upsertBudgetEntries, copyBudgetYear } from '@/lib/db/budget'

export const dynamic = 'force-dynamic'

// GET /api/budget/entries?year=2026
export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const year = parseInt(searchParams.get('year') ?? '0')
  if (!year) return NextResponse.json({ error: 'Missing year' }, { status: 400 })

  const [entries, years] = await Promise.all([
    getBudgetEntries(supabase, year),
    getAvailableYears(supabase),
  ])
  return NextResponse.json({ entries, years })
}

// POST /api/budget/entries — batch upsert
export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()

  // Handle copy-year action
  if (body.action === 'copy') {
    const { from_year, to_year, copy_budget, copy_actual } = body
    await copyBudgetYear(supabase, from_year, to_year, copy_budget ?? true, copy_actual ?? false)
    const entries = await getBudgetEntries(supabase, to_year)
    const years = await getAvailableYears(supabase)
    return NextResponse.json({ entries, years })
  }

  // Normal upsert
  const items: Array<{ item_id: string; year: number; month: number; budget?: number; actual?: number | null }> =
    Array.isArray(body) ? body : [body]
  if (items.length === 0) return NextResponse.json({ entries: [] })

  const entries = await upsertBudgetEntries(supabase, items)
  return NextResponse.json({ entries })
}
