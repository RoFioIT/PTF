'use client'

export const dynamic = 'force-dynamic'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function RegisterPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const supabase = createClient()
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: `${location.origin}/dashboard` },
    })

    if (error) {
      setError(error.message)
    } else {
      setSuccess(true)
    }
    setLoading(false)
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-page">
        <div className="text-center">
          <div className="text-4xl mb-4">📬</div>
          <h2 className="text-xl font-semibold text-ink mb-2">Check your email</h2>
          <p className="text-ink-3">We sent a confirmation link to {email}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-page">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-ink">PTF</h1>
          <p className="text-ink-3 mt-2">Portfolio Tracker</p>
        </div>

        <div className="bg-panel border border-line rounded-xl p-8">
          <h2 className="text-xl font-semibold text-ink mb-6">Create account</h2>

          <form onSubmit={handleRegister} className="space-y-4">
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
                minLength={8}
                className="w-full bg-page border border-line rounded-lg px-4 py-2.5 text-ink placeholder-ink-4 focus:outline-none focus:border-indigo-500 transition-colors"
                placeholder="min. 8 characters"
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
              {loading ? 'Creating account…' : 'Create account'}
            </button>
          </form>

          <p className="text-center text-ink-3 text-sm mt-6">
            Already have an account?{' '}
            <a href="/login" className="text-accent hover:text-accent">
              Sign in
            </a>
          </p>
        </div>
      </div>
    </div>
  )
}
