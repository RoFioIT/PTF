'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'
import {
  LayoutDashboard,
  Briefcase,
  ArrowLeftRight,
  TrendingUp,
  BarChart3,
  DollarSign,
  Landmark,
  PiggyBank,
  Home,
  ScanLine,
  LogOut,
  MoreHorizontal,
  X,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { clsx } from 'clsx'

const primaryNavItems = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/portfolios', label: 'Portfolios', icon: Briefcase },
  { href: '/transactions', label: 'Transactions', icon: ArrowLeftRight },
  { href: '/analytics', label: 'Analytics', icon: BarChart3 },
]

const secondaryNavItems = [
  { href: '/dividends', label: 'Dividends', icon: DollarSign },
  { href: '/scans', label: 'Scans', icon: ScanLine },
  { href: '/cash-accounts', label: 'Cash Accounts', icon: Landmark },
  { href: '/budget', label: 'Budget', icon: PiggyBank },
  { href: '/properties', label: 'Properties', icon: Home },
]

const navGroups = [
  { label: 'Invest', hrefs: ['/dashboard', '/portfolios', '/transactions', '/dividends', '/analytics'] },
  { label: 'Research', hrefs: ['/scans'] },
  { label: 'Wealth', hrefs: ['/cash-accounts', '/budget', '/properties'] },
]

const allNavItems = [...primaryNavItems, ...secondaryNavItems]

function itemsFor(hrefs: string[]) {
  return hrefs.map((h) => allNavItems.find((i) => i.href === h)).filter((i): i is (typeof allNavItems)[number] => !!i)
}

export function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()
  const [moreOpen, setMoreOpen] = useState(false)

  async function handleSignOut() {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  const isActive = (href: string) =>
    pathname === href || (href !== '/dashboard' && pathname.startsWith(href))

  return (
    <>
      {/* ── Desktop Sidebar ──────────────────────────────────────── */}
      <aside className="hidden md:flex w-60 flex-shrink-0 flex-col h-screen bg-panel border-r border-line">
        {/* Logo */}
        <div className="px-6 py-5 border-b border-line">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center">
              <TrendingUp className="w-4 h-4 text-white" />
            </div>
            <div>
              <p className="font-bold text-ink text-sm">PTF</p>
              <p className="text-xs text-ink-3">Portfolio tracker</p>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-4 overflow-y-auto space-y-5">
          {navGroups.map((group) => (
            <div key={group.label}>
              <p className="px-3 mb-1 text-xs font-medium text-ink-4">{group.label}</p>
              <div className="space-y-0.5">
                {itemsFor(group.hrefs).map(({ href, label, icon: Icon }) => {
                  const active = isActive(href)
                  return (
                    <Link
                      key={href}
                      href={href}
                      className={clsx(
                        'flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors',
                        active
                          ? 'bg-accent/10 text-accent font-medium'
                          : 'text-ink-3 hover:text-ink hover:bg-surface'
                      )}
                    >
                      <Icon className="w-4 h-4 flex-shrink-0" />
                      {label}
                    </Link>
                  )
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* Sign out */}
        <div className="px-3 py-4 border-t border-line">
          <button
            onClick={handleSignOut}
            className="flex items-center gap-3 px-3 py-2.5 w-full rounded-lg text-sm text-ink-3 hover:text-loss hover:bg-red-400/10 transition-all"
          >
            <LogOut className="w-4 h-4" />
            Sign out
          </button>
        </div>
      </aside>

      {/* ── Mobile Top Bar ───────────────────────────────────────── */}
      <header className="md:hidden fixed top-0 left-0 right-0 z-40 h-12 bg-panel/95 backdrop-blur border-b border-line flex items-center px-4 gap-3">
        <div className="w-7 h-7 rounded-lg bg-indigo-600 flex items-center justify-center flex-shrink-0">
          <TrendingUp className="w-3.5 h-3.5 text-white" />
        </div>
        <div>
          <p className="font-bold text-ink text-sm leading-none">PTF</p>
          <p className="text-[10px] text-ink-3">Portfolio tracker</p>
        </div>
      </header>

      {/* ── Mobile Bottom Navigation ─────────────────────────────── */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-panel/95 backdrop-blur border-t border-line safe-area-inset-bottom">
        <div className="flex items-stretch">
          {primaryNavItems.map(({ href, label, icon: Icon }) => {
            const active = isActive(href)
            return (
              <Link
                key={href}
                href={href}
                className={clsx(
                  'flex-1 flex flex-col items-center justify-center gap-1 py-2.5 transition-colors',
                  active ? 'text-accent' : 'text-ink-3 active:text-ink-2'
                )}
              >
                <Icon className="w-5 h-5" />
                <span className="text-[10px] font-medium leading-none">{label}</span>
              </Link>
            )
          })}

          {/* More button */}
          <button
            onClick={() => setMoreOpen(true)}
            className={clsx(
              'flex-1 flex flex-col items-center justify-center gap-1 py-2.5 transition-colors',
              secondaryNavItems.some((item) => isActive(item.href))
                ? 'text-accent'
                : 'text-ink-3 active:text-ink-2'
            )}
          >
            <MoreHorizontal className="w-5 h-5" />
            <span className="text-[10px] font-medium leading-none">More</span>
          </button>
        </div>
      </nav>

      {/* ── Mobile "More" Drawer ─────────────────────────────────── */}
      {moreOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex flex-col justify-end">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-ink/40 backdrop-blur-sm"
            onClick={() => setMoreOpen(false)}
          />
          {/* Sheet */}
          <div className="relative bg-panel border-t border-line rounded-t-2xl pb-8 pt-3 px-4">
            {/* Handle */}
            <div className="w-10 h-1 bg-line-strong rounded-full mx-auto mb-4" />

            <div className="flex items-center justify-between mb-3 px-1">
              <span className="text-sm font-semibold text-ink">More</span>
              <button
                onClick={() => setMoreOpen(false)}
                className="p-1.5 rounded-lg text-ink-3 hover:text-ink hover:bg-ink/10 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-0.5">
              {navGroups.map((group) => {
                const items = itemsFor(group.hrefs).filter((i) => secondaryNavItems.some((x) => x.href === i.href))
                if (items.length === 0) return null
                return (
                  <div key={group.label} className="pb-1">
                    <p className="px-4 pt-2 pb-1 text-xs font-medium text-ink-4">{group.label}</p>
                    {items.map(({ href, label, icon: Icon }) => {
                      const active = isActive(href)
                      return (
                        <Link
                          key={href}
                          href={href}
                          onClick={() => setMoreOpen(false)}
                          className={clsx(
                            'flex items-center gap-3 px-4 py-3.5 rounded-xl text-sm transition-colors',
                            active
                              ? 'bg-accent/10 text-accent font-medium'
                              : 'text-ink-2 hover:bg-surface active:bg-line'
                          )}
                        >
                          <Icon className="w-5 h-5 flex-shrink-0" />
                          {label}
                        </Link>
                      )
                    })}
                  </div>
                )
              })}

              <div className="border-t border-line mt-2 pt-2">
                <button
                  onClick={handleSignOut}
                  className="flex items-center gap-3 px-4 py-3.5 w-full rounded-xl text-sm text-ink-3 hover:text-loss hover:bg-red-400/10 active:bg-red-400/20 transition-all"
                >
                  <LogOut className="w-5 h-5" />
                  Sign out
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
