import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import type { CashAccount, CashAccountSnapshot } from '@/types/database'

// ── Constants ─────────────────────────────────────────────────
const CATEGORIES = ['Cash', 'Cash Risparmio', 'Investimenti - Assurance', 'Investimenti - Borsa'] as const

const COLORS = {
  bg:           [10,  10,  15]  as [number, number, number],
  card:         [18,  18,  26]  as [number, number, number],
  border:       [30,  30,  46]  as [number, number, number],
  accent:       [99,  102, 241] as [number, number, number],  // indigo-500
  accentLight:  [199, 210, 254] as [number, number, number],  // indigo-200
  white:        [232, 232, 240] as [number, number, number],
  muted:        [107, 114, 128] as [number, number, number],
  emerald:      [16,  185, 129] as [number, number, number],
  red:          [239, 68,  68]  as [number, number, number],
  amber:        [245, 158, 11]  as [number, number, number],

  catColors: {
    'Cash':                     [156, 163, 175] as [number, number, number],
    'Cash Risparmio':           [56,  189, 248] as [number, number, number],
    'Investimenti - Assurance': [167, 139, 250] as [number, number, number],
    'Investimenti - Borsa':     [129, 140, 248] as [number, number, number],
  } as Record<string, [number, number, number]>,
}

// ── Helpers ───────────────────────────────────────────────────

function fmt(v: number): string {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency', currency: 'EUR',
    minimumFractionDigits: 0, maximumFractionDigits: 0,
  }).format(v)
}

function fmtPct(v: number): string {
  return `${v >= 0 ? '+' : ''}${v.toFixed(1)}%`
}

function quarterLabel(q: string): string { return q.replace('-Q', ' Q') }
function yearOf(q: string): string { return q.slice(0, 4) }

function getBalance(snapshots: CashAccountSnapshot[], accountId: string, quarter: string): number {
  const s = snapshots.find((x) => x.account_id === accountId && x.quarter === quarter)
  return s != null ? Number(s.balance) : 0
}

function totalForQuarter(accounts: CashAccount[], snapshots: CashAccountSnapshot[], quarter: string): number {
  return accounts.reduce((sum, a) => sum + getBalance(snapshots, a.id, quarter), 0)
}

function categoryTotal(accounts: CashAccount[], snapshots: CashAccountSnapshot[], cat: string, quarter: string): number {
  return accounts.filter((a) => a.category === cat).reduce((s, a) => s + getBalance(snapshots, a.id, quarter), 0)
}

// ── Main generator ────────────────────────────────────────────

export function generateCashReport(
  accounts: CashAccount[],
  snapshots: CashAccountSnapshot[],
): void {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const PAGE_W = 210
  const PAGE_H = 297
  const MARGIN = 14
  const CONTENT_W = PAGE_W - MARGIN * 2

  // All quarters that have at least one snapshot, sorted
  const allQuarters = [...new Set(snapshots.map((s) => s.quarter))].sort()
  const activeAccounts = accounts.filter((a) => a.is_active)

  if (allQuarters.length === 0) {
    doc.text('No data available.', MARGIN, 30)
    doc.save('PTF_Cash_Report.pdf')
    return
  }

  const latestQ = allQuarters[allQuarters.length - 1]
  const grandTotal = totalForQuarter(activeAccounts, snapshots, latestQ)
  const generatedAt = new Date().toLocaleDateString('fr-FR', {
    day: 'numeric', month: 'long', year: 'numeric',
  })

  // ── Page background ───────────────────────────────────────────
  function fillPage() {
    doc.setFillColor(...COLORS.bg)
    doc.rect(0, 0, PAGE_W, PAGE_H, 'F')
  }
  fillPage()

  // ── Section heading helper ────────────────────────────────────
  let curY = 0
  function sectionHeading(title: string, y: number): number {
    doc.setFillColor(...COLORS.accent)
    doc.rect(MARGIN, y, 2, 5, 'F')
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(9)
    doc.setTextColor(...COLORS.accentLight)
    doc.text(title.toUpperCase(), MARGIN + 5, y + 4)
    return y + 10
  }

  // ═══════════════════════════════════════════════════════════════
  // COVER / HEADER BLOCK
  // ═══════════════════════════════════════════════════════════════

  // Accent bar top
  doc.setFillColor(...COLORS.accent)
  doc.rect(0, 0, PAGE_W, 1.5, 'F')

  // Title area
  doc.setFillColor(...COLORS.card)
  doc.rect(0, 1.5, PAGE_W, 46, 'F')

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(22)
  doc.setTextColor(...COLORS.white)
  doc.text('Cash Accounts', MARGIN, 22)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.setTextColor(...COLORS.muted)
  doc.text('Portfolio Evolution Report', MARGIN, 30)

  doc.setFontSize(8)
  doc.text(`Generated ${generatedAt}  ·  ${allQuarters.length} quarters  ·  ${activeAccounts.length} accounts`, MARGIN, 37)

  // Grand total chip
  doc.setFillColor(...COLORS.accent)
  doc.roundedRect(PAGE_W - MARGIN - 52, 14, 52, 22, 3, 3, 'F')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(13)
  doc.setTextColor(...COLORS.white)
  doc.text(fmt(grandTotal), PAGE_W - MARGIN - 4, 24, { align: 'right' })
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7)
  doc.setTextColor(...COLORS.accentLight)
  doc.text(`as of ${quarterLabel(latestQ)}`, PAGE_W - MARGIN - 4, 31, { align: 'right' })

  curY = 56

  // ═══════════════════════════════════════════════════════════════
  // SECTION 1 — ANNUAL SUMMARY
  // ═══════════════════════════════════════════════════════════════
  curY = sectionHeading('Annual Summary', curY)

  // For each year: use last available quarter of that year
  const years = [...new Set(allQuarters.map(yearOf))].sort()
  const annualRows: (string | number)[][] = []

  years.forEach((year, i) => {
    const quartersOfYear = allQuarters.filter((q) => yearOf(q) === year)
    const lastQ = quartersOfYear[quartersOfYear.length - 1]
    const total = totalForQuarter(activeAccounts, snapshots, lastQ)

    // Previous year last quarter total
    const prevYearQuarters = i > 0
      ? allQuarters.filter((q) => yearOf(q) === years[i - 1])
      : []
    const prevTotal = prevYearQuarters.length > 0
      ? totalForQuarter(activeAccounts, snapshots, prevYearQuarters[prevYearQuarters.length - 1])
      : null

    const delta = prevTotal !== null ? total - prevTotal : null
    const pct = delta !== null && prevTotal !== null && prevTotal !== 0 ? (delta / Math.abs(prevTotal)) * 100 : null

    annualRows.push([
      year,
      quarterLabel(lastQ),
      fmt(total),
      delta !== null ? fmt(delta) : '—',
      pct !== null ? fmtPct(pct) : '—',
    ])
  })

  autoTable(doc, {
    startY: curY,
    head: [['Year', 'Ref. Quarter', 'Total', 'Change vs prev year', '% Change']],
    body: annualRows,
    margin: { left: MARGIN, right: MARGIN },
    styles: {
      font: 'helvetica', fontSize: 8, cellPadding: 3,
      fillColor: COLORS.card, textColor: COLORS.white,
      lineColor: COLORS.border, lineWidth: 0.1,
    },
    headStyles: {
      fillColor: COLORS.border, textColor: COLORS.muted,
      fontStyle: 'bold', fontSize: 7,
    },
    columnStyles: {
      0: { fontStyle: 'bold', cellWidth: 18 },
      1: { cellWidth: 28, textColor: COLORS.muted },
      2: { halign: 'right', fontStyle: 'bold', cellWidth: 38 },
      3: { halign: 'right', cellWidth: 38 },
      4: { halign: 'right', cellWidth: 28 },
    },
    didParseCell: (data) => {
      if (data.section === 'body' && data.column.index === 3) {
        const val = String(data.cell.raw)
        if (val.startsWith('+') || (val !== '—' && !val.startsWith('-'))) {
          data.cell.styles.textColor = COLORS.emerald
        } else if (val.startsWith('-')) {
          data.cell.styles.textColor = COLORS.red
        }
      }
      if (data.section === 'body' && data.column.index === 4) {
        const val = String(data.cell.raw)
        if (val.startsWith('+')) data.cell.styles.textColor = COLORS.emerald
        else if (val.startsWith('-')) data.cell.styles.textColor = COLORS.red
      }
    },
  })

  curY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10

  // ═══════════════════════════════════════════════════════════════
  // SECTION 2 — QUARTERLY EVOLUTION (category breakdown)
  // ═══════════════════════════════════════════════════════════════
  curY = sectionHeading('Quarterly Evolution by Category', curY)

  const quarterlyRows: (string | number)[][] = allQuarters.map((q, i) => {
    const total = totalForQuarter(activeAccounts, snapshots, q)
    const prevTotal = i > 0 ? totalForQuarter(activeAccounts, snapshots, allQuarters[i - 1]) : null
    const delta = prevTotal !== null ? total - prevTotal : null

    return [
      quarterLabel(q),
      ...CATEGORIES.map((cat) => fmt(categoryTotal(activeAccounts, snapshots, cat, q))),
      fmt(total),
      delta !== null ? fmt(delta) : '—',
    ]
  }).reverse()  // Most recent first

  const catHeaders = CATEGORIES.map((c) => c.replace('Investimenti - ', 'Inv. '))

  autoTable(doc, {
    startY: curY,
    head: [['Quarter', ...catHeaders, 'Total', 'Δ Quarter']],
    body: quarterlyRows,
    margin: { left: MARGIN, right: MARGIN },
    styles: {
      font: 'helvetica', fontSize: 7.5, cellPadding: 2.5,
      fillColor: COLORS.card, textColor: COLORS.white,
      lineColor: COLORS.border, lineWidth: 0.1,
    },
    headStyles: {
      fillColor: COLORS.border, textColor: COLORS.muted,
      fontStyle: 'bold', fontSize: 6.5,
    },
    columnStyles: {
      0: { fontStyle: 'bold', cellWidth: 20 },
      1: { halign: 'right', cellWidth: 22 },
      2: { halign: 'right', cellWidth: 24 },
      3: { halign: 'right', cellWidth: 30 },
      4: { halign: 'right', cellWidth: 28 },
      5: { halign: 'right', fontStyle: 'bold', cellWidth: 28 },
      6: { halign: 'right', cellWidth: 22 },
    },
    didParseCell: (data) => {
      if (data.section === 'body' && data.column.index === 6) {
        const val = String(data.cell.raw)
        if (val.startsWith('+')) data.cell.styles.textColor = COLORS.emerald
        else if (val.startsWith('-')) data.cell.styles.textColor = COLORS.red
        else if (val !== '—') data.cell.styles.textColor = COLORS.muted
      }
    },
    didDrawPage: () => { fillPage() },
  })

  curY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10

  // ═══════════════════════════════════════════════════════════════
  // SECTION 3 — ACCOUNT DETAIL (one block per account, grouped by owner)
  // ═══════════════════════════════════════════════════════════════

  // Check if we need a new page
  if (curY > PAGE_H - 60) {
    doc.addPage()
    fillPage()
    curY = 14
  }

  curY = sectionHeading('Account Detail', curY)

  const owners = [...new Set(activeAccounts.map((a) => a.owner))].sort()

  for (const owner of owners) {
    const ownerAccounts = activeAccounts.filter((a) => a.owner === owner)

    // Owner label
    if (curY > PAGE_H - 30) { doc.addPage(); fillPage(); curY = 14 }

    doc.setFillColor(...COLORS.border)
    doc.rect(MARGIN, curY, CONTENT_W, 6, 'F')
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(7.5)
    doc.setTextColor(...COLORS.muted)
    doc.text(owner.toUpperCase(), MARGIN + 3, curY + 4.2)
    curY += 8

    // Table: rows = quarters (most recent first), cols = accounts for this owner
    const quarterRows = allQuarters.slice().reverse().map((q) => {
      const rowTotal = ownerAccounts.reduce((s, a) => s + getBalance(snapshots, a.id, q), 0)
      return [
        quarterLabel(q),
        ...ownerAccounts.map((a) => {
          const bal = getBalance(snapshots, a.id, q)
          return bal > 0 ? fmt(bal) : '—'
        }),
        fmt(rowTotal),
      ]
    })

    const accountHeaders = ownerAccounts.map((a) => {
      const name = a.name.length > 20 ? a.name.slice(0, 18) + '…' : a.name
      return `${name}\n(${a.category.replace('Investimenti - ', 'Inv.')})`
    })

    autoTable(doc, {
      startY: curY,
      head: [['Quarter', ...accountHeaders, 'Owner Total']],
      body: quarterRows,
      margin: { left: MARGIN, right: MARGIN },
      styles: {
        font: 'helvetica', fontSize: 7, cellPadding: 2.5,
        fillColor: COLORS.card, textColor: COLORS.white,
        lineColor: COLORS.border, lineWidth: 0.1,
      },
      headStyles: {
        fillColor: COLORS.border, textColor: COLORS.muted,
        fontStyle: 'bold', fontSize: 6.5, minCellHeight: 10,
      },
      columnStyles: {
        0: { fontStyle: 'bold', cellWidth: 20 },
        [ownerAccounts.length + 1]: { halign: 'right', fontStyle: 'bold' },
      },
      didParseCell: (data) => {
        if (data.section === 'body' && data.column.index > 0) {
          if (String(data.cell.raw) === '—') {
            data.cell.styles.textColor = COLORS.border
          } else {
            data.cell.styles.halign = 'right'
          }
        }
      },
      didDrawPage: () => { fillPage() },
    })

    curY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8
  }

  // ── Footer on each page ───────────────────────────────────────
  const pageCount = doc.getNumberOfPages()
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i)
    doc.setFillColor(...COLORS.accent)
    doc.rect(0, PAGE_H - 1, PAGE_W, 1, 'F')
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(6.5)
    doc.setTextColor(...COLORS.muted)
    doc.text(`PTF — Cash Accounts Report  ·  ${generatedAt}`, MARGIN, PAGE_H - 4)
    doc.text(`${i} / ${pageCount}`, PAGE_W - MARGIN, PAGE_H - 4, { align: 'right' })
  }

  // ── Save ──────────────────────────────────────────────────────
  const filename = `PTF_Cash_${latestQ.replace('-', '_')}_${new Date().toISOString().slice(0, 10)}.pdf`
  doc.save(filename)
}
