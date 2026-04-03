-- WARNING: This schema is for context only and is not meant to be run.
-- Table order and constraints may not be valid for execution.

CREATE TABLE public.asset_identifiers (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  asset_id uuid NOT NULL,
  type USER-DEFINED NOT NULL,
  value text NOT NULL,
  CONSTRAINT asset_identifiers_pkey PRIMARY KEY (id),
  CONSTRAINT asset_identifiers_asset_id_fkey FOREIGN KEY (asset_id) REFERENCES public.assets(id)
);
CREATE TABLE public.asset_prices (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  asset_id uuid NOT NULL,
  price numeric NOT NULL CHECK (price >= 0::numeric),
  currency text NOT NULL DEFAULT 'EUR'::text,
  date date NOT NULL,
  source text,
  CONSTRAINT asset_prices_pkey PRIMARY KEY (id),
  CONSTRAINT asset_prices_asset_id_fkey FOREIGN KEY (asset_id) REFERENCES public.assets(id)
);
CREATE TABLE public.assets (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  asset_type USER-DEFINED NOT NULL DEFAULT 'stock'::asset_type,
  currency text NOT NULL DEFAULT 'EUR'::text,
  sector text,
  country text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT assets_pkey PRIMARY KEY (id)
);
CREATE TABLE public.cash_movements (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  portfolio_id uuid NOT NULL,
  type USER-DEFINED NOT NULL,
  amount numeric NOT NULL CHECK (amount > 0::numeric),
  currency text NOT NULL DEFAULT 'EUR'::text,
  date date NOT NULL,
  notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT cash_movements_pkey PRIMARY KEY (id),
  CONSTRAINT cash_movements_portfolio_id_fkey FOREIGN KEY (portfolio_id) REFERENCES public.portfolios(id)
);
CREATE TABLE public.dividends (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  portfolio_id uuid NOT NULL,
  asset_id uuid NOT NULL,
  amount numeric NOT NULL CHECK (amount > 0::numeric),
  tax numeric NOT NULL DEFAULT 0 CHECK (tax >= 0::numeric),
  currency text NOT NULL DEFAULT 'EUR'::text,
  date date NOT NULL,
  notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT dividends_pkey PRIMARY KEY (id),
  CONSTRAINT dividends_portfolio_id_fkey FOREIGN KEY (portfolio_id) REFERENCES public.portfolios(id),
  CONSTRAINT dividends_asset_id_fkey FOREIGN KEY (asset_id) REFERENCES public.assets(id)
);
CREATE TABLE public.portfolios (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  type USER-DEFINED NOT NULL,
  base_currency text NOT NULL DEFAULT 'EUR'::text,
  accounting_method USER-DEFINED NOT NULL DEFAULT 'PRU'::accounting_method,
  description text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT portfolios_pkey PRIMARY KEY (id),
  CONSTRAINT portfolios_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
CREATE TABLE public.share_grants (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  portfolio_id uuid NOT NULL,
  asset_id uuid NOT NULL,
  share_type text NOT NULL CHECK (share_type = ANY (ARRAY['AFSS'::text, 'DFSS'::text])),
  grant_date date NOT NULL,
  vesting_date date NOT NULL,
  granted_quantity numeric NOT NULL CHECK (granted_quantity > 0::numeric),
  vesting_pct numeric CHECK (vesting_pct >= 0::numeric AND vesting_pct <= 100::numeric),
  status text NOT NULL DEFAULT 'unvested'::text CHECK (status = ANY (ARRAY['unvested'::text, 'vested'::text, 'lapsed'::text])),
  notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT share_grants_pkey PRIMARY KEY (id),
  CONSTRAINT share_grants_portfolio_id_fkey FOREIGN KEY (portfolio_id) REFERENCES public.portfolios(id),
  CONSTRAINT share_grants_asset_id_fkey FOREIGN KEY (asset_id) REFERENCES public.assets(id)
);
CREATE TABLE public.transactions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  portfolio_id uuid NOT NULL,
  asset_id uuid NOT NULL,
  type USER-DEFINED NOT NULL,
  quantity numeric NOT NULL CHECK (quantity > 0::numeric),
  price numeric NOT NULL CHECK (price >= 0::numeric),
  fees numeric NOT NULL DEFAULT 0 CHECK (fees >= 0::numeric),
  currency text NOT NULL DEFAULT 'EUR'::text,
  date date NOT NULL,
  notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT transactions_pkey PRIMARY KEY (id),
  CONSTRAINT transactions_portfolio_id_fkey FOREIGN KEY (portfolio_id) REFERENCES public.portfolios(id),
  CONSTRAINT transactions_asset_id_fkey FOREIGN KEY (asset_id) REFERENCES public.assets(id)
);