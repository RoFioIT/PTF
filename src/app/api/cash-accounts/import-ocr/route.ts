import { NextResponse } from 'next/server'
import { parseBankinText } from '@/lib/import/parseBankinText'

export const runtime = 'nodejs'
export const maxDuration = 60

export async function POST(request: Request) {
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

  const arrayBuffer = await file.arrayBuffer()
  const buffer = Buffer.from(arrayBuffer)

  let rawText = ''
  try {
    // Dynamic import so a module-level crash is catchable and returns JSON
    const { createWorker, PSM } = await import('tesseract.js')

    const worker = await createWorker('fra', 1, { logger: () => {} })
    try {
      await worker.setParameters({ tessedit_pageseg_mode: PSM.SINGLE_BLOCK })
      const result = await worker.recognize(buffer)
      rawText = result.data.text
    } finally {
      await worker.terminate().catch(() => {})
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: `OCR failed: ${message}` }, { status: 500 })
  }

  const items = parseBankinText(rawText)
  return NextResponse.json({ items, rawText })
}
