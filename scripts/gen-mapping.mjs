// Generate bankin mapping localStorage snippet from remote Supabase accounts
// Run: SUPABASE_SERVICE_ROLE_KEY=... node scripts/gen-mapping.mjs

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://enpdtuunxsqxyjjhizga.supabase.co'
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SERVICE_ROLE_KEY) {
  console.error('Missing SUPABASE_SERVICE_ROLE_KEY env var')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
})

// Mapping: bankin key → { match: string to find in account name, or 'skip' }
const RULES = [
  // skip: portfolio cash legs
  { key: 'BOURSOBANK::ord (de) fiorentino (especes)', skip: true },
  { key: 'BOURSOBANK::pea fiorentino (especes)',       skip: true },
  // skip: loans
  { key: "CCF::pret modeliz ccf - achat d'ancien seul",  skip: true },
  { key: "CCF::pret optimise ccf - achat d'ancien seul", skip: true },

  // map by name fragment (case-insensitive search against acc.name)
  { key: 'BOURSOBANK::ord (de) fiorentino',       nameMatch: 'CTO Bourso' },
  { key: 'BOURSOBANK::conto corrente roberto',    nameMatch: 'Conto corrente Roberto' },
  { key: 'BOURSOBANK::pea fiorentino',            nameMatch: 'PEA Bourso' },
  { key: 'BOURSOBANK::conto corrente comune',     nameMatch: 'Conto corrente Comune' },
  { key: 'BOURSOBANK::livret bourso+',            nameMatch: 'Livret Bourso' },
  { key: 'BOURSOBANK::plan épargne retraite',     nameMatch: 'Plan Épargne Retraite' },
  { key: 'BOURSOBANK::contrat n° 52144254',       nameMatch: 'Contrat N°' },
  { key: 'BOURSOBANK::mme gabrieli silvia',       nameMatch: 'Bourso Silvia' },
  { key: 'CCF::livret a silvia',                  nameMatch: 'Livret A Silvia' },
  { key: 'CCF::hsbc assurance vie silvia',        nameMatch: 'Assurance Vie Silvia' },
  { key: 'CCF::compte ccf silvia',                nameMatch: 'CCF Silvia' },
  { key: 'CCF::ldd silvia',                       nameMatch: 'LDD Silvia' },
  { key: 'CCF::livret ccf equilibre silvia',      nameMatch: 'Equilibre Silvia' },
  { key: 'CCF::livret ccf epargne 100k',          nameMatch: 'Epargne 100' },
  { key: 'CCF::conto comune',                     nameMatch: 'Conto Comune' },
  { key: 'CCF::studio',                           nameMatch: 'Studio' },
  { key: 'CCF::livret a roberto',                 nameMatch: 'Livret A Roberto' },
  { key: 'CCF::livret a laura',                   nameMatch: 'Livret A Laura' },
  { key: 'CCF::livret a chiara',                  nameMatch: 'Livret A Chiara' },
  { key: 'CCF::hsbc assurance vie roberto',       nameMatch: 'Assurance Vie Roberto' },
  { key: 'CCF::ldd roberto',                      nameMatch: 'LDD Roberto' },
  { key: 'CCF::livret ccf equilibre chiara',      nameMatch: 'Equilibre Chiara' },
]

async function run() {
  const { data: accounts, error } = await supabase
    .from('cash_accounts')
    .select('id, name, owner, is_active')
    .order('owner', { ascending: true })
    .order('name', { ascending: true })

  if (error) throw new Error(error.message)

  console.log(`\nFetched ${accounts.length} cash accounts:\n`)
  for (const a of accounts) {
    console.log(`  [${a.owner}] ${a.name}  →  ${a.id}  (active: ${a.is_active})`)
  }
  console.log()

  const profiles = {}
  const unmapped = []

  for (const rule of RULES) {
    if (rule.skip) {
      profiles[rule.key] = { accountId: '__skip__' }
      continue
    }

    const fragment = rule.nameMatch.toLowerCase()
    const match = accounts.find(a => a.name.toLowerCase().includes(fragment))

    if (match) {
      profiles[rule.key] = { accountId: match.id }
      console.log(`  ✓ ${rule.key}  →  ${match.name} (${match.id})`)
    } else {
      unmapped.push(rule.key)
      console.log(`  ✗ NO MATCH: ${rule.key}  (looking for "${rule.nameMatch}")`)
    }
  }

  // Accounts that don't exist in PTF yet — leave out of mapping (user will handle via UI)
  const noEquivalent = [
    'BOURSOBANK::livret bourso2+',
    'CCF::livret ccf equilibre1',
    'CCF::livret ccf equilibre2',
    'REVOLUT FR::pocket eur',
  ]
  console.log(`\nSkipped (no PTF equivalent): ${noEquivalent.join(', ')}`)

  if (unmapped.length) {
    console.log(`\nWarning — ${unmapped.length} rules had no account name match. Fix nameMatch strings above.`)
  }

  const storeValue = JSON.stringify(profiles)
  console.log(`\n${'─'.repeat(70)}`)
  console.log('Paste this in your browser console on the PTF app:\n')
  console.log(`localStorage.setItem('ptf_bankin_mapping_v1', ${JSON.stringify(storeValue)});`)
  console.log(`console.log('✓ Mapping injected:', Object.keys(${JSON.stringify(profiles)}).length, 'rules')`)
  console.log(`${'─'.repeat(70)}\n`)
}

run().catch(err => {
  console.error('Failed:', err.message)
  process.exit(1)
})
