export interface ExtractedItem {
  sourceSection: string  // e.g. "REVOLUT FR"
  sourceName: string     // e.g. "Pocket EUR"
  amount: number         // e.g. 377.95
  rawLine: string
}

/**
 * Amount line regex — handles French number formats from OCR:
 *   "130 €", "876,32 €", "1 234,56 €", "1\u202f234,56 €"
 * The [€E] alternative handles occasional OCR misread of €
 * Allows trailing ">" character (Bankin' shows "130 € >" with a chevron)
 */
const AMOUNT_RE = /^\s*[\d\s\u202f]+(?:,\d{1,2})?\s*[€E]\s*>?\s*$/

/**
 * Section header: all-uppercase, no digits, length > 2
 * e.g. "BOURSOBANK", "REVOLUT FR", "BANKIN'"
 */
function isSectionHeader(line: string): boolean {
  const trimmed = line.trim()
  if (trimmed.length <= 2) return false
  if (/\d/.test(trimmed)) return false
  // Allow apostrophe (BANKIN'), hyphen, spaces
  const letters = trimmed.replace(/[\s'\-\.]/g, '')
  if (letters.length === 0) return false
  return letters === letters.toUpperCase() && /[A-Z]/.test(letters)
}

function parseAmount(line: string): number {
  // Remove € and any ">" chevrons
  let s = line.replace(/[€E>]/g, '')
  // Remove all whitespace variants (regular space, thin space, non-breaking space)
  s = s.replace(/[\s\u202f\u00a0]/g, '')
  // French decimal: comma → period
  s = s.replace(',', '.')
  return parseFloat(s)
}

/**
 * Parse raw OCR text from a Bankin'/banking aggregator screenshot.
 * Returns structured account name + amount pairs.
 */
export function parseBankinText(rawText: string): ExtractedItem[] {
  const lines = rawText
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length >= 2)

  const items: ExtractedItem[] = []
  let currentSection = ''
  let pendingName = ''
  type State = 'SEEK_ACCOUNT' | 'SEEK_AMOUNT'
  let state: State = 'SEEK_ACCOUNT'

  for (const line of lines) {
    const isAmount = AMOUNT_RE.test(line)
    const isHeader = isSectionHeader(line)

    if (isHeader) {
      currentSection = line.trim()
      state = 'SEEK_ACCOUNT'
      pendingName = ''
      continue
    }

    if (state === 'SEEK_ACCOUNT') {
      if (!isAmount) {
        pendingName = line
        state = 'SEEK_AMOUNT'
      }
      // If an amount appears without a preceding name, skip it
      continue
    }

    // state === 'SEEK_AMOUNT'
    if (isAmount) {
      const amount = parseAmount(line)
      if (!isNaN(amount) && pendingName.length > 0) {
        items.push({
          sourceSection: currentSection,
          sourceName: pendingName,
          amount,
          rawLine: `${pendingName} — ${line.trim()}`,
        })
      }
      pendingName = ''
      state = 'SEEK_ACCOUNT'
    } else {
      // Another name line before finding an amount → replace pending
      pendingName = line
    }
  }

  return items
}
