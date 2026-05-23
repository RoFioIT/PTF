'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { deleteScanSession } from '@/lib/db/scans'

export async function deleteScanSessionAction(sessionId: string): Promise<void> {
  const supabase = await createClient()
  await deleteScanSession(supabase, sessionId)
  revalidatePath('/scans')
}
