// ============================================================
// Next.js Proxy (middleware) — session refresh + MFA enforcement
//
// Responsibilities:
//   1. Refresh the Supabase session cookie (required for SSR)
//   2. Redirect unauthenticated users to /login
//   3. Enforce MFA: redirect to /mfa/setup (enroll) or
//      /mfa/verify (challenge) when AAL2 is required/missing
// ============================================================

import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function proxy(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // Refresh session — do NOT remove, required for auth to work with SSR
  const { data: { user } } = await supabase.auth.getUser()

  const { pathname } = request.nextUrl
  const isPublic  = pathname.startsWith('/login') || pathname.startsWith('/register')
  const isMfaPage = pathname.startsWith('/mfa')
  const isApi     = pathname.startsWith('/api/')

  // ── Unauthenticated ───────────────────────────────────────────
  if (!user) {
    if (!isPublic && !isApi) {
      const url = request.nextUrl.clone()
      url.pathname = '/login'
      return NextResponse.redirect(url)
    }
    return supabaseResponse
  }

  // ── Authenticated: enforce MFA assurance level ────────────────
  if (!isApi) {
    const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel()

    if (aal) {
      const { currentLevel, nextLevel } = aal

      // MFA enrolled but not yet verified this session → challenge
      if (nextLevel === 'aal2' && currentLevel !== 'aal2' && !isMfaPage) {
        const url = request.nextUrl.clone()
        url.pathname = '/mfa/verify'
        return NextResponse.redirect(url)
      }

      // No MFA enrolled yet → force enrollment
      if (nextLevel === 'aal1' && !isMfaPage && !isPublic) {
        const url = request.nextUrl.clone()
        url.pathname = '/mfa/setup'
        return NextResponse.redirect(url)
      }

      // Fully authenticated trying to access auth/mfa pages → dashboard
      if (currentLevel === 'aal2' && (isPublic || isMfaPage)) {
        const url = request.nextUrl.clone()
        url.pathname = '/dashboard'
        return NextResponse.redirect(url)
      }
    }
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon\\.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
