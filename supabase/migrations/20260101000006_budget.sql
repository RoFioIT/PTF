-- ============================================================
-- Budget Tracker — Monthly Budget & Actual Tracking
-- Three tables: categories → items → entries (year/month values)
-- ============================================================

-- Category groups (INCOME, HOME EXPENSES, etc.)
CREATE TABLE budget_categories (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name        text        NOT NULL,
  type        text        NOT NULL CHECK (type IN ('income', 'savings', 'expense')),
  sort_order  int         NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- Individual line items within a category
CREATE TABLE budget_items (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  category_id  uuid        NOT NULL REFERENCES budget_categories(id) ON DELETE CASCADE,
  name         text        NOT NULL,
  sort_order   int         NOT NULL DEFAULT 0,
  is_active    boolean     NOT NULL DEFAULT true,
  created_at   timestamptz NOT NULL DEFAULT now()
);

-- Monthly budget & actual entries (one row per item × year × month)
CREATE TABLE budget_entries (
  id          uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id     uuid          NOT NULL REFERENCES budget_items(id) ON DELETE CASCADE,
  year        int           NOT NULL,
  month       int           NOT NULL CHECK (month BETWEEN 1 AND 12),
  budget      numeric(14,2) NOT NULL DEFAULT 0,
  actual      numeric(14,2),
  created_at  timestamptz   NOT NULL DEFAULT now(),
  updated_at  timestamptz   NOT NULL DEFAULT now(),
  UNIQUE (item_id, year, month)
);

-- Indexes
CREATE INDEX idx_budget_categories_user ON budget_categories(user_id);
CREATE INDEX idx_budget_items_category  ON budget_items(category_id);
CREATE INDEX idx_budget_items_user      ON budget_items(user_id);
CREATE INDEX idx_budget_entries_item    ON budget_entries(item_id);
CREATE INDEX idx_budget_entries_year    ON budget_entries(year);

-- Auto-update updated_at
CREATE TRIGGER set_budget_entries_updated_at
  BEFORE UPDATE ON budget_entries
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ── RLS ─────────────────────────────────────────────────────────
ALTER TABLE budget_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE budget_items      ENABLE ROW LEVEL SECURITY;
ALTER TABLE budget_entries    ENABLE ROW LEVEL SECURITY;

CREATE POLICY "budget_categories_owner" ON budget_categories
  FOR ALL TO authenticated
  USING     (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "budget_items_owner" ON budget_items
  FOR ALL TO authenticated
  USING     (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "budget_entries_owner" ON budget_entries
  FOR ALL TO authenticated
  USING (
    item_id IN (SELECT id FROM budget_items WHERE user_id = auth.uid())
  )
  WITH CHECK (
    item_id IN (SELECT id FROM budget_items WHERE user_id = auth.uid())
  );
