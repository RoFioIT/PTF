'use client'

export const dynamic = 'force-dynamic'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    // Client created lazily — only when user submits, avoids server-side init issues
    const supabase = createClient()
    const { error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      setError(error.message)
    } else {
      // Check MFA assurance level — redirect to challenge if needed
      const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel()
      if (aal?.nextLevel === 'aal2' && aal.currentLevel !== 'aal2') {
        router.push('/mfa/verify')
      } else if (aal?.nextLevel === 'aal1') {
        // No MFA enrolled yet — enforce setup
        router.push('/mfa/setup')
      } else {
        router.push('/dashboard')
      }
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
          <h2 className="text-xl font-semibold text-ink mb-6">Sign in</h2>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-sm text-ink-3 mb-1.5">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full bg-page border border-line rounded-lg px-4 py-2.5 text-ink placeholder-ink-4 focus:outline-none focus:border-indigo-500 transition-colors"
                placeholder="you@example.com"
              />
            </div>

            <div>
              <label className="block text-sm text-ink-3 mb-1.5">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full bg-page border border-line rounded-lg px-4 py-2.5 text-ink placeholder-ink-4 focus:outline-none focus:border-indigo-500 transition-colors"
                placeholder="••••••••"
              />
            </div>

            {error && (
              <p className="text-loss text-sm bg-red-400/10 border border-red-400/20 rounded-lg px-4 py-2.5">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-medium rounded-lg px-4 py-2.5 transition-colors"
            >
              {loading ? 'Signing in…' : 'Sign in'}
            </button>
          </form>

          <p className="text-center text-ink-3 text-sm mt-6">
            No account?{' '}
            <a href="/register" className="text-accent hover:text-accent">
              Create one
            </a>
          </p>
        </div>
      </div>
    </div>
  )
}
