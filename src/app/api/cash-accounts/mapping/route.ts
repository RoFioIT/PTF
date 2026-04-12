import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// GET — return all mapping rules for the authenticated user
// Response: { [mappingKey]: accountId | null }  (null = skip)
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabase
    .from('bankin_mappings')
    .select('mapping_key, account_id')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const mapping: Record<string, string | null> = {}
  for (const row of data ?? []) {
    mapping[row.mapping_key] = row.account_id ?? null
  }
  return NextResponse.json(mapping)
}

// PUT — full replace: sync entire localStorage mapping to DB
// Body: { [mappingKey]: '__skip__' | accountUUID }
export async function PUT(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json() as Record<string, string>

  const rows = Object.entries(body).map(([key, accountId]) => ({
    user_id: user.id,
    mapping_key: key,
    account_id: accountId === '__skip__' ? null : accountId,
  }))

  // Replace all rules atomically
  const { error: delErr } = await supabase
    .from('bankin_mappings')
    .delete()
    .eq('user_id', user.id)
  if (delErr) return NextResponse.json({ error: delErr.message }, { status: 500 })

  if (rows.length > 0) {
    const { error: insErr } = await supabase.from('bankin_mappings').insert(rows)
    if (insErr) return NextResponse.json({ error: insErr.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, count: rows.length })
}
