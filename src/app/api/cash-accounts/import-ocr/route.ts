import { NextResponse } from 'next/server'
import { createWorker, PSM } from 'tesseract.js'
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
  let worker
  try {
    worker = await createWorker('fra', 1, {
      logger: () => {},
    })
    await worker.setParameters({
      tessedit_pageseg_mode: PSM.SINGLE_BLOCK,
    })
    const result = await worker.recognize(buffer)
    rawText = result.data.text
  } catch (err) {
    return NextResponse.json(
      { error: `OCR failed: ${(err as Error).message}` },
      { status: 500 }
    )
  } finally {
    if (worker) await worker.terminate().catch(() => {})
  }

  const items = parseBankinText(rawText)
  return NextResponse.json({ items, rawText })
}
