-- ============================================================
-- Budget Seed — Categories, Items, and 2026 Budget Values
-- Run in Supabase SQL editor after applying migration 000006.
-- Replace the UUID below with your actual auth.users id.
-- ============================================================

DO $$
DECLARE
  v_uid uuid := '268dbb82-ef5d-4a89-b0f7-9de1081d86e8';

  -- category IDs
  c_income   uuid; c_savings  uuid; c_home     uuid; c_daily    uuid;
  c_children uuid; c_transport uuid; c_health  uuid; c_insurance uuid;
  c_education uuid; c_charity  uuid; c_obligations uuid;
  c_business uuid; c_entertain uuid; c_pets    uuid;
  c_subscriptions uuid; c_vacation uuid; c_misc uuid;

  -- item IDs — INCOME
  i_wages uuid; i_affitto uuid;

  -- item IDs — TO SAVINGS
  i_la_chiara uuid; i_la_laura uuid; i_la_roberto uuid; i_la_silvia uuid;
  i_cto_rob uuid; i_pea_rob uuid; i_ass_ccf_rob uuid; i_ass_ccf_sil uuid;

  -- item IDs — HOME
  i_mortgage uuid; i_ass_pret uuid; i_gas uuid; i_ass_hab_fay uuid;
  i_ass_hab_trev uuid; i_ass_hab_studio uuid; i_abb uuid; i_phone uuid;
  i_internet uuid; i_maintenance uuid; i_travaux uuid; i_charges uuid;

  -- item IDs — DAILY LIVING
  i_groceries uuid; i_clothing_daily uuid; i_dining uuid;

  -- item IDs — CHILDREN
  i_child_medical uuid; i_child_clothing uuid; i_fatture uuid;
  i_babysitting uuid; i_toys uuid; i_piscine uuid;

  -- item IDs — TRANSPORTATION
  i_car_payment uuid; i_car_insurance uuid; i_fuel uuid;
  i_transit uuid; i_repairs uuid;

  -- item IDs — HEALTH
  i_emergency uuid;

  -- item IDs — INSURANCE (empty placeholders)
  i_ins_auto uuid; i_ins_health uuid; i_ins_home uuid; i_ins_life uuid;

  -- item IDs — EDUCATION
  i_books_edu uuid; i_music uuid;

  -- item IDs — ENTERTAINMENT
  i_books_ent uuid; i_sports uuid; i_vac_travel_ent uuid;

  -- item IDs — VACATION
  i_travel_vac uuid;

BEGIN

  -- ── INSERT CATEGORIES ──────────────────────────────────────
  INSERT INTO budget_categories (user_id, name, type, sort_order) VALUES
    (v_uid, 'INCOME',           'income',  1) RETURNING id INTO c_income;
  INSERT INTO budget_categories (user_id, name, type, sort_order) VALUES
    (v_uid, 'TO SAVINGS',       'savings', 2) RETURNING id INTO c_savings;
  INSERT INTO budget_categories (user_id, name, type, sort_order) VALUES
    (v_uid, 'HOME EXPENSES',    'expense', 3) RETURNING id INTO c_home;
  INSERT INTO budget_categories (user_id, name, type, sort_order) VALUES
    (v_uid, 'DAILY LIVING',     'expense', 4) RETURNING id INTO c_daily;
  INSERT INTO budget_categories (user_id, name, type, sort_order) VALUES
    (v_uid, 'CHILDREN',         'expense', 5) RETURNING id INTO c_children;
  INSERT INTO budget_categories (user_id, name, type, sort_order) VALUES
    (v_uid, 'TRANSPORTATION',   'expense', 6) RETURNING id INTO c_transport;
  INSERT INTO budget_categories (user_id, name, type, sort_order) VALUES
    (v_uid, 'HEALTH',           'expense', 7) RETURNING id INTO c_health;
  INSERT INTO budget_categories (user_id, name, type, sort_order) VALUES
    (v_uid, 'INSURANCE',        'expense', 8) RETURNING id INTO c_insurance;
  INSERT INTO budget_categories (user_id, name, type, sort_order) VALUES
    (v_uid, 'EDUCATION',        'expense', 9) RETURNING id INTO c_education;
  INSERT INTO budget_categories (user_id, name, type, sort_order) VALUES
    (v_uid, 'CHARITY / GIFTS',  'expense', 10) RETURNING id INTO c_charity;
  INSERT INTO budget_categories (user_id, name, type, sort_order) VALUES
    (v_uid, 'OBLIGATIONS',      'expense', 11) RETURNING id INTO c_obligations;
  INSERT INTO budget_categories (user_id, name, type, sort_order) VALUES
    (v_uid, 'BUSINESS EXPENSE', 'expense', 12) RETURNING id INTO c_business;
  INSERT INTO budget_categories (user_id, name, type, sort_order) VALUES
    (v_uid, 'ENTERTAINMENT',    'expense', 13) RETURNING id INTO c_entertain;
  INSERT INTO budget_categories (user_id, name, type, sort_order) VALUES
    (v_uid, 'PETS',             'expense', 14) RETURNING id INTO c_pets;
  INSERT INTO budget_categories (user_id, name, type, sort_order) VALUES
    (v_uid, 'SUBSCRIPTIONS',    'expense', 15) RETURNING id INTO c_subscriptions;
  INSERT INTO budget_categories (user_id, name, type, sort_order) VALUES
    (v_uid, 'VACATION',         'expense', 16) RETURNING id INTO c_vacation;
  INSERT INTO budget_categories (user_id, name, type, sort_order) VALUES
    (v_uid, 'MISCELLANEOUS',    'expense', 17) RETURNING id INTO c_misc;

  -- ── INSERT ITEMS ───────────────────────────────────────────

  -- INCOME
  INSERT INTO budget_items (user_id, category_id, name, sort_order) VALUES (v_uid, c_income, 'Wages & Tips',    1) RETURNING id INTO i_wages;
  INSERT INTO budget_items (user_id, category_id, name, sort_order) VALUES (v_uid, c_income, 'Affitto studio',  2) RETURNING id INTO i_affitto;

  -- TO SAVINGS
  INSERT INTO budget_items (user_id, category_id, name, sort_order) VALUES (v_uid, c_savings, 'Livret A Chiara',       1) RETURNING id INTO i_la_chiara;
  INSERT INTO budget_items (user_id, category_id, name, sort_order) VALUES (v_uid, c_savings, 'Livret A Laura',        2) RETURNING id INTO i_la_laura;
  INSERT INTO budget_items (user_id, category_id, name, sort_order) VALUES (v_uid, c_savings, 'Livret A Roberto',      3) RETURNING id INTO i_la_roberto;
  INSERT INTO budget_items (user_id, category_id, name, sort_order) VALUES (v_uid, c_savings, 'Livret A Silvia',       4) RETURNING id INTO i_la_silvia;
  INSERT INTO budget_items (user_id, category_id, name, sort_order) VALUES (v_uid, c_savings, 'Compte Titre Roberto',  5) RETURNING id INTO i_cto_rob;
  INSERT INTO budget_items (user_id, category_id, name, sort_order) VALUES (v_uid, c_savings, 'PEA Roberto',           6) RETURNING id INTO i_pea_rob;
  INSERT INTO budget_items (user_id, category_id, name, sort_order) VALUES (v_uid, c_savings, 'Assurance CCF Roberto', 7) RETURNING id INTO i_ass_ccf_rob;
  INSERT INTO budget_items (user_id, category_id, name, sort_order) VALUES (v_uid, c_savings, 'Assurance CCF Silvia',  8) RETURNING id INTO i_ass_ccf_sil;

  -- HOME EXPENSES
  INSERT INTO budget_items (user_id, category_id, name, sort_order) VALUES (v_uid, c_home, 'Mortgage / Rent',             1) RETURNING id INTO i_mortgage;
  INSERT INTO budget_items (user_id, category_id, name, sort_order) VALUES (v_uid, c_home, 'Assurance prêt La Fayette',   2) RETURNING id INTO i_ass_pret;
  INSERT INTO budget_items (user_id, category_id, name, sort_order) VALUES (v_uid, c_home, 'Gas / Elettricità Fayette',   3) RETURNING id INTO i_gas;
  INSERT INTO budget_items (user_id, category_id, name, sort_order) VALUES (v_uid, c_home, 'Assurance habitation Fayette',4) RETURNING id INTO i_ass_hab_fay;
  INSERT INTO budget_items (user_id, category_id, name, sort_order) VALUES (v_uid, c_home, 'Assurance habitation Trevise',5) RETURNING id INTO i_ass_hab_trev;
  INSERT INTO budget_items (user_id, category_id, name, sort_order) VALUES (v_uid, c_home, 'Assurance habitation Studio', 6) RETURNING id INTO i_ass_hab_studio;
  INSERT INTO budget_items (user_id, category_id, name, sort_order) VALUES (v_uid, c_home, 'Abbonement (TV, Music)',      7) RETURNING id INTO i_abb;
  INSERT INTO budget_items (user_id, category_id, name, sort_order) VALUES (v_uid, c_home, 'Phone',                       8) RETURNING id INTO i_phone;
  INSERT INTO budget_items (user_id, category_id, name, sort_order) VALUES (v_uid, c_home, 'Internet',                    9) RETURNING id INTO i_internet;
  INSERT INTO budget_items (user_id, category_id, name, sort_order) VALUES (v_uid, c_home, 'Maintenance',                10) RETURNING id INTO i_maintenance;
  INSERT INTO budget_items (user_id, category_id, name, sort_order) VALUES (v_uid, c_home, 'Travaux façade Lafayette',   11) RETURNING id INTO i_travaux;
  INSERT INTO budget_items (user_id, category_id, name, sort_order) VALUES (v_uid, c_home, 'Charges Fayette',            12) RETURNING id INTO i_charges;

  -- DAILY LIVING
  INSERT INTO budget_items (user_id, category_id, name, sort_order) VALUES (v_uid, c_daily, 'Groceries',       1) RETURNING id INTO i_groceries;
  INSERT INTO budget_items (user_id, category_id, name, sort_order) VALUES (v_uid, c_daily, 'Clothing',        2) RETURNING id INTO i_clothing_daily;
  INSERT INTO budget_items (user_id, category_id, name, sort_order) VALUES (v_uid, c_daily, 'Dining / Eating Out', 3) RETURNING id INTO i_dining;

  -- CHILDREN
  INSERT INTO budget_items (user_id, category_id, name, sort_order) VALUES (v_uid, c_children, 'Medical',             1) RETURNING id INTO i_child_medical;
  INSERT INTO budget_items (user_id, category_id, name, sort_order) VALUES (v_uid, c_children, 'Clothing',            2) RETURNING id INTO i_child_clothing;
  INSERT INTO budget_items (user_id, category_id, name, sort_order) VALUES (v_uid, c_children, 'Fatture facil famille',3) RETURNING id INTO i_fatture;
  INSERT INTO budget_items (user_id, category_id, name, sort_order) VALUES (v_uid, c_children, 'Babysitting',         4) RETURNING id INTO i_babysitting;
  INSERT INTO budget_items (user_id, category_id, name, sort_order) VALUES (v_uid, c_children, 'Toys / Games',        5) RETURNING id INTO i_toys;
  INSERT INTO budget_items (user_id, category_id, name, sort_order) VALUES (v_uid, c_children, 'Piscine / GRS',       6) RETURNING id INTO i_piscine;

  -- TRANSPORTATION
  INSERT INTO budget_items (user_id, category_id, name, sort_order) VALUES (v_uid, c_transport, 'Vehicle Payments',  1) RETURNING id INTO i_car_payment;
  INSERT INTO budget_items (user_id, category_id, name, sort_order) VALUES (v_uid, c_transport, 'Vehicle Insurance', 2) RETURNING id INTO i_car_insurance;
  INSERT INTO budget_items (user_id, category_id, name, sort_order) VALUES (v_uid, c_transport, 'Fuel',              3) RETURNING id INTO i_fuel;
  INSERT INTO budget_items (user_id, category_id, name, sort_order) VALUES (v_uid, c_transport, 'Bus / Taxi / Train',4) RETURNING id INTO i_transit;
  INSERT INTO budget_items (user_id, category_id, name, sort_order) VALUES (v_uid, c_transport, 'Repairs',           5) RETURNING id INTO i_repairs;

  -- HEALTH
  INSERT INTO budget_items (user_id, category_id, name, sort_order) VALUES (v_uid, c_health, 'Emergency Fund', 1) RETURNING id INTO i_emergency;

  -- INSURANCE (placeholders)
  INSERT INTO budget_items (user_id, category_id, name, sort_order) VALUES (v_uid, c_insurance, 'Auto',        1) RETURNING id INTO i_ins_auto;
  INSERT INTO budget_items (user_id, category_id, name, sort_order) VALUES (v_uid, c_insurance, 'Health',      2) RETURNING id INTO i_ins_health;
  INSERT INTO budget_items (user_id, category_id, name, sort_order) VALUES (v_uid, c_insurance, 'Home/Rental', 3) RETURNING id INTO i_ins_home;
  INSERT INTO budget_items (user_id, category_id, name, sort_order) VALUES (v_uid, c_insurance, 'Life',        4) RETURNING id INTO i_ins_life;

  -- EDUCATION
  INSERT INTO budget_items (user_id, category_id, name, sort_order) VALUES (v_uid, c_education, 'Books',         1) RETURNING id INTO i_books_edu;
  INSERT INTO budget_items (user_id, category_id, name, sort_order) VALUES (v_uid, c_education, 'Music Lessons', 2) RETURNING id INTO i_music;

  -- ENTERTAINMENT
  INSERT INTO budget_items (user_id, category_id, name, sort_order) VALUES (v_uid, c_entertain, 'Books',          1) RETURNING id INTO i_books_ent;
  INSERT INTO budget_items (user_id, category_id, name, sort_order) VALUES (v_uid, c_entertain, 'Sports',         2) RETURNING id INTO i_sports;
  INSERT INTO budget_items (user_id, category_id, name, sort_order) VALUES (v_uid, c_entertain, 'Vacation / Travel', 3) RETURNING id INTO i_vac_travel_ent;

  -- VACATION
  INSERT INTO budget_items (user_id, category_id, name, sort_order) VALUES (v_uid, c_vacation, 'Travel', 1) RETURNING id INTO i_travel_vac;

  -- ── INSERT 2026 BUDGET ENTRIES ─────────────────────────────
  -- Uniform monthly values (generate_series)

  -- INCOME: Wages & Tips = 11200/mo
  INSERT INTO budget_entries (item_id, year, month, budget)
    SELECT i_wages, 2026, m, 11200 FROM generate_series(1,12) m;

  -- INCOME: Affitto studio = 1000/mo
  INSERT INTO budget_entries (item_id, year, month, budget)
    SELECT i_affitto, 2026, m, 1000 FROM generate_series(1,12) m;

  -- TO SAVINGS: all zeros
  INSERT INTO budget_entries (item_id, year, month, budget)
    SELECT id, 2026, m, 0
    FROM (VALUES (i_la_chiara),(i_la_laura),(i_la_roberto),(i_la_silvia),
                 (i_cto_rob),(i_pea_rob),(i_ass_ccf_rob),(i_ass_ccf_sil)) AS t(id)
    CROSS JOIN generate_series(1,12) m;

  -- HOME: Mortgage = 4050/mo
  INSERT INTO budget_entries (item_id, year, month, budget)
    SELECT i_mortgage, 2026, m, 4050 FROM generate_series(1,12) m;

  -- HOME: Assurance prêt La Fayette (varies quarterly)
  INSERT INTO budget_entries (item_id, year, month, budget)
    SELECT i_ass_pret, 2026, v.m, v.b FROM (VALUES
      (1,91.96),(2,91.96),(3,137.47),(4,91.96),(5,91.96),(6,137.47),
      (7,91.96),(8,91.96),(9,137.47),(10,91.96),(11,91.96),(12,137.47)
    ) AS v(m,b);

  -- HOME: Gas/Elettricità = 110/mo
  INSERT INTO budget_entries (item_id, year, month, budget)
    SELECT i_gas, 2026, m, 110 FROM generate_series(1,12) m;

  -- HOME: Assurance habitation Fayette (June only = 519.33)
  INSERT INTO budget_entries (item_id, year, month, budget)
    SELECT i_ass_hab_fay, 2026, v.m, v.b FROM (VALUES
      (1,0),(2,0),(3,0),(4,0),(5,0),(6,519.33),(7,0),(8,0),(9,0),(10,0),(11,0),(12,0)
    ) AS v(m,b);

  -- HOME: Assurance habitation Trevise = all 0
  INSERT INTO budget_entries (item_id, year, month, budget)
    SELECT i_ass_hab_trev, 2026, m, 0 FROM generate_series(1,12) m;

  -- HOME: Assurance habitation Studio (quarterly = 45.51)
  INSERT INTO budget_entries (item_id, year, month, budget)
    SELECT i_ass_hab_studio, 2026, v.m, v.b FROM (VALUES
      (1,0),(2,0),(3,45.51),(4,0),(5,0),(6,45.51),(7,0),(8,0),(9,45.51),(10,0),(11,0),(12,45.51)
    ) AS v(m,b);

  -- HOME: Abbonement (Jan=95, rest=20)
  INSERT INTO budget_entries (item_id, year, month, budget)
    SELECT i_abb, 2026, v.m, v.b FROM (VALUES
      (1,95),(2,20),(3,20),(4,20),(5,20),(6,20),(7,20),(8,20),(9,20),(10,20),(11,20),(12,20)
    ) AS v(m,b);

  -- HOME: Phone = 26/mo
  INSERT INTO budget_entries (item_id, year, month, budget)
    SELECT i_phone, 2026, m, 26 FROM generate_series(1,12) m;

  -- HOME: Internet = 29/mo
  INSERT INTO budget_entries (item_id, year, month, budget)
    SELECT i_internet, 2026, m, 29 FROM generate_series(1,12) m;

  -- HOME: Maintenance = 100/mo
  INSERT INTO budget_entries (item_id, year, month, budget)
    SELECT i_maintenance, 2026, m, 100 FROM generate_series(1,12) m;

  -- HOME: Travaux façade (Jun/Sep/Dec = 10000)
  INSERT INTO budget_entries (item_id, year, month, budget)
    SELECT i_travaux, 2026, v.m, v.b FROM (VALUES
      (1,0),(2,0),(3,0),(4,0),(5,0),(6,10000),(7,0),(8,0),(9,10000),(10,0),(11,0),(12,10000)
    ) AS v(m,b);

  -- HOME: Charges Fayette = 193.33/mo
  INSERT INTO budget_entries (item_id, year, month, budget)
    SELECT i_charges, 2026, m, 193.33 FROM generate_series(1,12) m;

  -- DAILY LIVING
  INSERT INTO budget_entries (item_id, year, month, budget) SELECT i_groceries,     2026, m, 900 FROM generate_series(1,12) m;
  INSERT INTO budget_entries (item_id, year, month, budget) SELECT i_clothing_daily, 2026, m, 100 FROM generate_series(1,12) m;
  INSERT INTO budget_entries (item_id, year, month, budget) SELECT i_dining,         2026, m, 400 FROM generate_series(1,12) m;

  -- CHILDREN
  INSERT INTO budget_entries (item_id, year, month, budget) SELECT i_child_medical,  2026, m, 100 FROM generate_series(1,12) m;
  INSERT INTO budget_entries (item_id, year, month, budget) SELECT i_child_clothing, 2026, m, 150 FROM generate_series(1,12) m;
  INSERT INTO budget_entries (item_id, year, month, budget) SELECT i_fatture,        2026, m, 100 FROM generate_series(1,12) m;
  INSERT INTO budget_entries (item_id, year, month, budget) SELECT i_babysitting,    2026, m, 250 FROM generate_series(1,12) m;
  INSERT INTO budget_entries (item_id, year, month, budget) SELECT i_toys,           2026, m, 100 FROM generate_series(1,12) m;
  INSERT INTO budget_entries (item_id, year, month, budget) SELECT i_piscine,        2026, m, 200 FROM generate_series(1,12) m;

  -- TRANSPORTATION: Vehicle Payments = 180/mo
  INSERT INTO budget_entries (item_id, year, month, budget)
    SELECT i_car_payment, 2026, m, 180 FROM generate_series(1,12) m;

  -- TRANSPORTATION: Vehicle Insurance (varies)
  INSERT INTO budget_entries (item_id, year, month, budget)
    SELECT i_car_insurance, 2026, v.m, v.b FROM (VALUES
      (1,66.70),(2,66.70),(3,66.70),(4,66.70),(5,66.70),(6,66.70),
      (7,66.70),(8,66.70),(9,80.52),(10,73.37),(11,73.37),(12,73.37)
    ) AS v(m,b);

  -- TRANSPORTATION: Fuel (varies)
  INSERT INTO budget_entries (item_id, year, month, budget)
    SELECT i_fuel, 2026, v.m, v.b FROM (VALUES
      (1,0),(2,300),(3,100),(4,0),(5,100),(6,100),(7,100),(8,100),(9,100),(10,0),(11,0),(12,100)
    ) AS v(m,b);

  -- TRANSPORTATION: Bus/Taxi/Train = 40/mo
  INSERT INTO budget_entries (item_id, year, month, budget)
    SELECT i_transit, 2026, m, 40 FROM generate_series(1,12) m;

  -- TRANSPORTATION: Repairs (varies)
  INSERT INTO budget_entries (item_id, year, month, budget)
    SELECT i_repairs, 2026, v.m, v.b FROM (VALUES
      (1,41.67),(2,41.67),(3,200),(4,41.67),(5,41.67),(6,41.67),
      (7,41.67),(8,41.67),(9,400),(10,41.67),(11,41.67),(12,41.67)
    ) AS v(m,b);

  -- HEALTH: Emergency = 200/mo
  INSERT INTO budget_entries (item_id, year, month, budget)
    SELECT i_emergency, 2026, m, 200 FROM generate_series(1,12) m;

  -- INSURANCE: all zeros
  INSERT INTO budget_entries (item_id, year, month, budget)
    SELECT id, 2026, m, 0
    FROM (VALUES (i_ins_auto),(i_ins_health),(i_ins_home),(i_ins_life)) AS t(id)
    CROSS JOIN generate_series(1,12) m;

  -- EDUCATION
  INSERT INTO budget_entries (item_id, year, month, budget) SELECT i_books_edu, 2026, m, 50  FROM generate_series(1,12) m;
  INSERT INTO budget_entries (item_id, year, month, budget) SELECT i_music,     2026, m, 100 FROM generate_series(1,12) m;

  -- ENTERTAINMENT: Books = 20/mo
  INSERT INTO budget_entries (item_id, year, month, budget)
    SELECT i_books_ent, 2026, m, 20 FROM generate_series(1,12) m;

  -- ENTERTAINMENT: Sports (quarterly = 100)
  INSERT INTO budget_entries (item_id, year, month, budget)
    SELECT i_sports, 2026, v.m, v.b FROM (VALUES
      (1,0),(2,0),(3,100),(4,0),(5,0),(6,100),(7,0),(8,0),(9,100),(10,0),(11,0),(12,100)
    ) AS v(m,b);

  -- ENTERTAINMENT: Vacation/Travel = 400/mo
  INSERT INTO budget_entries (item_id, year, month, budget)
    SELECT i_vac_travel_ent, 2026, m, 400 FROM generate_series(1,12) m;

  -- VACATION: Travel (varies)
  INSERT INTO budget_entries (item_id, year, month, budget)
    SELECT i_travel_vac, 2026, v.m, v.b FROM (VALUES
      (1,0),(2,5000),(3,0),(4,800),(5,800),(6,0),(7,1000),(8,3000),(9,0),(10,500),(11,0),(12,1000)
    ) AS v(m,b);

  RAISE NOTICE 'Budget seed completed successfully.';
END;
$$;
