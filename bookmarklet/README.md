# PTF — Bankin' Scraper Bookmarklet

Scrapes account balances from the Bankin' web app and downloads a CSV for review and PTF import.

## Installation

1. Open Chrome and show the bookmarks bar (`Ctrl+Shift+B` / `Cmd+Shift+B`)
2. Right-click the bookmarks bar → **Add page…**
3. Set **Name**: `PTF — Bankin Export`
4. Set **URL**: copy the entire contents of `bankin-scraper.min.js` and paste it as the URL
5. Click **Save**

## Usage

1. Open [app.bankin.com](https://app.bankin.com) and log in
2. Navigate to the **Accounts** page so all account balances are visible
3. Click the **PTF — Bankin Export** bookmark
4. A dialog appears showing the number of accounts found
5. Confirm or edit the **quarter** (format: `YYYY-Q1` to `YYYY-Q4`)
6. Click **↓ Download CSV**

## CSV Format

```
quarter,section,account,balance,currency,mapping_key
2026-Q2,BOURSOBANK,Compte courant Roberto,876.32,EUR,BOURSOBANK::compte courant roberto
2026-Q2,REVOLUT FR,Pocket EUR,377.95,EUR,REVOLUT FR::pocket eur
```

| Column | Description |
|--------|-------------|
| `quarter` | Quarter you selected (e.g. `2026-Q2`) |
| `section` | Bank / institution name from Bankin' |
| `account` | Account name from Bankin' |
| `balance` | Balance as a plain number |
| `currency` | Always `EUR` (Phase 1) |
| `mapping_key` | PTF internal key — used for Phase 2 auto-mapping |

## Phase 2 (coming)

Direct sync to PTF/Supabase — the bookmarklet will POST data to the PTF API using your browser session, with account matching via the `mapping_key` column.
