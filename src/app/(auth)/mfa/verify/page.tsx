'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function MfaVerifyPage() {
  const router = useRouter()
  const [factorId,  setFactorId]  = useState<string | null>(null)
  const [code,      setCode]      = useState('')
  const [error,     setError]     = useState<string | null>(null)
  const [loading,   setLoading]   = useState(false)
  const [preparing, setPreparing] = useState(true)

  useEffect(() => {
    async function prepare() {
      const supabase = createClient()
      const { data, error } = await supabase.auth.mfa.listFactors()
      if (error || !data?.totp?.length) {
        // No factor found — send to setup
        router.replace('/mfa/setup')
        return
      }
      setFactorId(data.totp[0].id)
      setPreparing(false)
    }
    prepare()
  }, [router])

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault()
    if (!factorId) return
    setLoading(true)
    setError(null)

    const supabase = createClient()

    const { data: challenge, error: cErr } = await supabase.auth.mfa.challenge({ factorId })
    if (cErr || !challenge) {
      setError(cErr?.message ?? 'Challenge failed')
      setLoading(false)
      return
    }

    const { error: vErr } = await supabase.auth.mfa.verify({
      factorId,
      challengeId: challenge.id,
      code: code.trim(),
    })

    if (vErr) {
      setError('Invalid code — please try again')
    } else {
      router.push('/dashboard')
      router.refresh()
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-page">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-ink">PTF</h1>
          <p className="text-ink-3 mt-2">Portfolio Tracker</p>
        </div>

        <div className="bg-panel border border-line rounded-xl p-8">
          <h2 className="text-xl font-semibold text-ink mb-2">Two-factor authentication</h2>
          <p className="text-ink-3 text-sm mb-6">
            Enter the 6-digit code from your Google Authenticator app.
          </p>

          {preparing ? (
            <p className="text-ink-3 text-sm text-center py-4">Loading…</p>
          ) : (
            <form onSubmit={handleVerify} className="space-y-4">
              <div>
                <label className="block text-sm text-ink-3 mb-1.5">Authenticator code</label>
                <input
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  autoFocus
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="000000"
                  required
                  className="w-full bg-page border border-line rounded-lg px-4 py-2.5 text-ink text-center text-xl tracking-widest placeholder-ink-4 focus:outline-none focus:border-indigo-500 transition-colors"
                />
              </div>

              {error && (
                <p className="text-loss text-sm bg-red-400/10 border border-red-400/20 rounded-lg px-4 py-2.5">
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={loading || code.length !== 6}
                className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-medium rounded-lg px-4 py-2.5 transition-colors"
              >
                {loading ? 'Verifying…' : 'Verify'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
