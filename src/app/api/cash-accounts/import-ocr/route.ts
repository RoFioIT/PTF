import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@/lib/supabase/server'
import type { ExtractedItem } from '@/lib/import/parseBankinText'

export const runtime = 'nodejs'
export const maxDuration = 30

const SYSTEM_PROMPT = `You are a financial data extractor. You will receive a screenshot from a banking aggregator app (such as Bankin', Linxo, or similar). Extract every bank account and its balance visible in the image.

Return ONLY a valid JSON array — no markdown, no explanation. Each element must have:
- "sourceSection": the bank or institution name (e.g. "BOURSOBANK", "REVOLUT FR", "BANKIN'") — use empty string if not visible
- "sourceName": the specific account or sub-account name (e.g. "Pocket EUR", "Compte courant", "Mme Gabrieli Silvia")
- "amount": the balance as a plain number in EUR (convert pence to pounds if GBP, etc.)

Example output:
[
  {"sourceSection":"BOURSOBANK","sourceName":"Mme Gabrieli Silvia","amount":876.32},
  {"sourceSection":"REVOLUT FR","sourceName":"Pocket EUR","amount":377.95},
  {"sourceSection":"BANKIN'","sourceName":"Compte courant","amount":130},
  {"sourceSection":"BANKIN'","sourceName":"Compte épargne","amount":15}
]

Rules:
- Skip totals/summary lines (e.g. "SOLDE TOTAL")
- Skip UI elements (buttons, labels, navigation)
- French number format: "876,32 €" → 876.32, "1 234,56 €" → 1234.56
- If the same institution has multiple accounts, emit one entry per account
- Return [] if no accounts are visible`

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { error: 'ANTHROPIC_API_KEY is not configured on this server' },
      { status: 500 }
    )
  }

  let formData: FormData
  try {
    formData = await request.formData()
  } catch {
    return NextResponse.json({ error: 'Invalid form data' }, { status: 400 })
  }

  const file = formData.get('image')
  if (!file || !(file instanceof Blob)) {
    return NextResponse.json({ error: 'No image field in request' }, { status: 400 })
  }

  // Convert image to base64
  const arrayBuffer = await file.arrayBuffer()
  const base64 = Buffer.from(arrayBuffer).toString('base64')
  const mediaType = (file.type || 'image/jpeg') as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp'

  try {
    const client = new Anthropic()
    const message = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: mediaType, data: base64 } },
            { type: 'text', text: 'Extract all bank accounts and balances from this screenshot.' },
          ],
        },
      ],
    })

    const raw = message.content[0].type === 'text' ? message.content[0].text.trim() : ''

    // Strip any accidental markdown fences
    const jsonStr = raw.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim()

    let items: ExtractedItem[]
    try {
      items = JSON.parse(jsonStr)
      if (!Array.isArray(items)) throw new Error('Expected array')
    } catch {
      return NextResponse.json(
        { error: `Could not parse model response: ${raw.slice(0, 200)}` },
        { status: 500 }
      )
    }

    return NextResponse.json({ items, rawText: raw })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: `Vision API failed: ${message}` }, { status: 500 })
  }
}
