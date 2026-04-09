// ============================================================
// Next.js Middleware — session refresh + MFA enforcement
//
// Runs on every request (except static assets).
// Responsibilities:
//   1. Refresh the Supabase session cookie (required for SSR)
//   2. Redirect unauthenticated users to /login
//   3. Enforce MFA: redirect to /mfa/setup (enroll) or
//      /mfa/verify (challenge) when AAL2 is required/missing
// ============================================================

import { createServerClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          response = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // Refresh session — must be called before any other supabase call
  const { data: { user } } = await supabase.auth.getUser()

  const { pathname } = request.nextUrl
  const isPublic  = pathname.startsWith('/login') || pathname.startsWith('/register')
  const isMfaPage = pathname.startsWith('/mfa')
  const isApi     = pathname.startsWith('/api')

  // ── Unauthenticated ───────────────────────────────────────────
  if (!user) {
    if (!isPublic && !isApi) {
      return NextResponse.redirect(new URL('/login', request.url))
    }
    return response
  }

  // ── Authenticated: check MFA assurance level ──────────────────
  if (!isApi) {
    const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel()

    if (aal) {
      const { currentLevel, nextLevel } = aal

      // MFA enrolled but not yet verified this session → challenge
      if (nextLevel === 'aal2' && currentLevel !== 'aal2' && !isMfaPage) {
        return NextResponse.redirect(new URL('/mfa/verify', request.url))
      }

      // No MFA enrolled yet → force enrollment (skip if already on setup)
      if (nextLevel === 'aal1' && !isMfaPage && !isPublic) {
        return NextResponse.redirect(new URL('/mfa/setup', request.url))
      }

      // Fully authenticated (aal2) trying to access auth/mfa pages → dashboard
      if (currentLevel === 'aal2' && (isPublic || isMfaPage)) {
        return NextResponse.redirect(new URL('/dashboard', request.url))
      }
    }
  }

  return response
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon\\.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
