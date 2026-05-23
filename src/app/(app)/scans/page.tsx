import { createClient } from '@/lib/supabase/server'
import { getScanSessions } from '@/lib/db/scans'
import { ScanSessionCard } from '@/components/scans/ScanSessionCard'
import { ScanLine } from 'lucide-react'

export default async function ScansPage() {
  const supabase = await createClient()
  const sessions = await getScanSessions(supabase)

  return (
    <div className="p-4 md:p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6 md:mb-8">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-white">Market Scans</h1>
          <p className="text-gray-400 text-sm mt-1">
            {sessions.length === 0
              ? 'No scans recorded yet'
              : `${sessions.length} scan${sessions.length !== 1 ? 's' : ''} recorded`}
          </p>
        </div>
      </div>

      {/* Empty state */}
      {sessions.length === 0 && (
        <div className="bg-[#12121a] border border-[#1e1e2e] rounded-xl px-6 py-14 text-center">
          <ScanLine className="w-8 h-8 text-zinc-700 mx-auto mb-3" />
          <p className="text-zinc-400 text-sm font-medium">No scans recorded yet</p>
          <p className="text-zinc-600 text-xs mt-1.5 max-w-sm mx-auto">
            Run{' '}
            <code className="font-mono bg-zinc-800 px-1.5 py-0.5 rounded text-indigo-400">
              /ptf-ai-chk scan &lt;sector&gt;
            </code>{' '}
            in Claude Code, then say{' '}
            <span className="text-zinc-400">"save this scan"</span> to record it here.
          </p>
        </div>
      )}

      {/* Session cards */}
      {sessions.length > 0 && (
        <div className="space-y-5">
          {sessions.map(session => (
            <ScanSessionCard key={session.id} session={session} />
          ))}
        </div>
      )}
    </div>
  )
}
