// ============================================================
// DB Layer — Scan Sessions & Instruments
// ============================================================

// eslint-disable-next-line @typescript-eslint/no-explicit-any
import type { SupabaseClient } from '@supabase/supabase-js'
import type { ScanSession, ScanInstrument, ScanSessionWithInstruments } from '@/types/database'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Client = SupabaseClient<any>

export async function getScanSessions(client: Client): Promise<ScanSessionWithInstruments[]> {
  const { data: sessions, error: sessErr } = await client
    .from('scan_sessions')
    .select('*')
    .order('scanned_at', { ascending: false })
    .order('created_at', { ascending: false })

  if (sessErr) throw new Error(`getScanSessions: ${sessErr.message}`)
  if (!sessions || sessions.length === 0) return []

  const sessionIds = sessions.map((s: ScanSession) => s.id)

  const { data: instruments, error: instErr } = await client
    .from('scan_instruments')
    .select('*')
    .in('session_id', sessionIds)
    .order('signal', { ascending: true })   // BUY → AVOID alphabetically
    .order('score', { ascending: false })

  if (instErr) throw new Error(`getScanSessions instruments: ${instErr.message}`)

  const instBySession = new Map<string, ScanInstrument[]>()
  for (const inst of (instruments ?? []) as ScanInstrument[]) {
    const list = instBySession.get(inst.session_id) ?? []
    list.push(inst)
    instBySession.set(inst.session_id, list)
  }

  return sessions.map((s: ScanSession) => ({
    ...s,
    instruments: instBySession.get(s.id) ?? [],
  }))
}

export async function deleteScanSession(client: Client, id: string): Promise<void> {
  const { error } = await client.from('scan_sessions').delete().eq('id', id)
  if (error) throw new Error(`deleteScanSession: ${error.message}`)
}
