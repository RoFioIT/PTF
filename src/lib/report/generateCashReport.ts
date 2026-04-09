import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import type { CashAccount, CashAccountSnapshot } from '@/types/database'

const COLORS = {
  bg:      [255, 255, 255] as [number, number, number],
  heading: [30,  30,  46]  as [number, number, number],
  row:     [248, 248, 252] as [number, number, number],
  alt:     [255, 255, 255] as [number, number, number],
  border:  [220, 220, 230] as [number, number, number],
  text:    [30,  30,  46]  as [number, number, number],
  muted:   [120, 120, 140] as [number, number, number],
  accent:  [99,  102, 241] as [number, number, number],
  emerald: [16,  185, 129] as [number, number, number],
  red:     [239, 68,  68]  as [number, number, number],
}

const CATEGORIES = [
  'Cash',
  'Cash Risparmio',
  'Investimenti - Assurance',
  'Investimenti - Borsa',
] as const

function fmt(v: number): string {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency', currency: 'EUR',
    minimumFractionDigits: 0, maximumFractionDigits: 0,
  }).format(v)
}

function latestBalance(snapshots: CashAccountSnapshot[], accountId: string): number {
  const rows = snapshots
    .filter((s) => s.account_id === accountId)
    .sort((a, b) => b.quarter.localeCompare(a.quarter))
  return rows.length > 0 ? Number(rows[0].balance) : 0
}

export function generateCashReport(
  accounts: CashAccount[],
  snapshots: CashAccountSnapshot[],
): void {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const MARGIN = 14
  const PAGE_W = 210
  const PAGE_H = 297

  const active = accounts.filter((a) => a.is_active)
  const latestQ = [...new Set(snapshots.map((s) => s.quarter))].sort().at(-1) ?? '—'
  const grandTotal = active.reduce((s, a) => s + latestBalance(snapshots, a.id), 0)
  const generatedAt = new Date().toLocaleDateString('fr-FR', {
    day: 'numeric', month: 'long', year: 'numeric',
  })

  // ── Header ────────────────────────────────────────────────────
  doc.setFillColor(...COLORS.accent)
  doc.rect(0, 0, PAGE_W, 1.5, 'F')

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(18)
  doc.setTextColor(...COLORS.heading)
  doc.text('Cash Accounts Report', MARGIN, 18)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.setTextColor(...COLORS.muted)
  doc.text(`Generated ${generatedAt}  ·  as of ${latestQ.replace('-Q', ' Q')}`, MARGIN, 25)

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(14)
  doc.setTextColor(...COLORS.accent)
  doc.text(fmt(grandTotal), PAGE_W - MARGIN, 18, { align: 'right' })
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7)
  doc.setTextColor(...COLORS.muted)
  doc.text('Total', PAGE_W - MARGIN, 25, { align: 'right' })

  // Divider
  doc.setDrawColor(...COLORS.border)
  doc.setLineWidth(0.3)
  doc.line(MARGIN, 29, PAGE_W - MARGIN, 29)

  // ── Section 1: Summary by category ───────────────────────────
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.setTextColor(...COLORS.heading)
  doc.text('BY CATEGORY', MARGIN, 37)

  const catRows = CATEGORIES.map((cat) => {
    const total = active
      .filter((a) => a.category === cat)
      .reduce((s, a) => s + latestBalance(snapshots, a.id), 0)
    const pct = grandTotal > 0 ? ((total / grandTotal) * 100).toFixed(1) + '%' : '—'
    return [cat, fmt(total), pct]
  })

  autoTable(doc, {
    startY: 40,
    head: [['Category', 'Balance', '% of total']],
    body: catRows,
    foot: [['Total', fmt(grandTotal), '100%']],
    margin: { left: MARGIN, right: MARGIN },
    tableWidth: 120,
    styles: {
      font: 'helvetica', fontSize: 8.5, cellPadding: 3.5,
      textColor: COLORS.text, lineColor: COLORS.border, lineWidth: 0.1,
    },
    headStyles: {
      fillColor: COLORS.heading, textColor: [255, 255, 255],
      fontStyle: 'bold', fontSize: 7.5,
    },
    footStyles: {
      fillColor: COLORS.row, textColor: COLORS.heading,
      fontStyle: 'bold', fontSize: 8.5,
    },
    alternateRowStyles: { fillColor: COLORS.alt },
    bodyStyles: { fillColor: COLORS.row },
    columnStyles: {
      0: { cellWidth: 70 },
      1: { halign: 'right', cellWidth: 30, fontStyle: 'bold' },
      2: { halign: 'right', cellWidth: 20, textColor: COLORS.muted },
    },
  })

  const afterCat = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY

  // ── Section 2: Account list ───────────────────────────────────
  const listStartY = afterCat + 12

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.setTextColor(...COLORS.heading)
  doc.text('ACCOUNT LIST', MARGIN, listStartY - 3)

  // Sort: by category then owner then name
  const sorted = [...active].sort((a, b) => {
    const catA = CATEGORIES.indexOf(a.category as typeof CATEGORIES[number])
    const catB = CATEGORIES.indexOf(b.category as typeof CATEGORIES[number])
    if (catA !== catB) return catA - catB
    if (a.owner !== b.owner) return a.owner.localeCompare(b.owner)
    return a.name.localeCompare(b.name)
  })

  const accountRows = sorted.map((a) => {
    const bal = latestBalance(snapshots, a.id)
    return [a.category, a.owner, a.name, a.currency, bal > 0 ? fmt(bal) : '—']
  })

  autoTable(doc, {
    startY: listStartY,
    head: [['Category', 'Owner', 'Account', 'Ccy', 'Balance']],
    body: accountRows,
    margin: { left: MARGIN, right: MARGIN },
    styles: {
      font: 'helvetica', fontSize: 8, cellPadding: 3,
      textColor: COLORS.text, lineColor: COLORS.border, lineWidth: 0.1,
    },
    headStyles: {
      fillColor: COLORS.heading, textColor: [255, 255, 255],
      fontStyle: 'bold', fontSize: 7.5,
    },
    alternateRowStyles: { fillColor: COLORS.alt },
    bodyStyles: { fillColor: COLORS.row },
    columnStyles: {
      0: { cellWidth: 45, textColor: COLORS.muted, fontSize: 7.5 },
      1: { cellWidth: 30 },
      2: { cellWidth: 65, fontStyle: 'bold' },
      3: { cellWidth: 12, halign: 'center', textColor: COLORS.muted },
      4: { halign: 'right', fontStyle: 'bold' },
    },
    didParseCell: (data: Parameters<NonNullable<Parameters<typeof autoTable>[1]['didParseCell']>>[0]) => {
      if (data.section === 'body' && data.column.index === 4) {
        const val = String(data.cell.raw)
        if (val === '—') data.cell.styles.textColor = COLORS.border
      }
    },
  })

  // ── Footer ────────────────────────────────────────────────────
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

  const filename = `PTF_Cash_${latestQ.replace('-', '_')}_${new Date().toISOString().slice(0, 10)}.pdf`
  doc.save(filename)
}
