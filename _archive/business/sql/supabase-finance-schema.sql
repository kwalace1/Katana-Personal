-- =============================================================================
-- Katana Finance — bookkeeping, reconciliation, and tax readiness (Phase 1)
-- Run in Supabase Dashboard → SQL Editor
-- =============================================================================

create extension if not exists "uuid-ossp";

-- -----------------------------------------------------------------------------
-- Entity settings (legal structure, tax basis, fiscal year)
-- -----------------------------------------------------------------------------
create table if not exists public.fin_entity_settings (
  id uuid primary key default uuid_generate_v4(),
  organization_id uuid not null unique references public.organizations(id) on delete cascade,
  entity_type text not null default 'sole_prop' check (
    entity_type in ('sole_prop', 'llc_disregarded', 'llc_partnership', 'llc_s_corp', 'partnership', 's_corp', 'c_corp')
  ),
  tax_basis text not null default 'cash' check (tax_basis in ('cash', 'accrual')),
  fiscal_year_end_month int not null default 12 check (fiscal_year_end_month between 1 and 12),
  fiscal_year_end_day int not null default 31 check (fiscal_year_end_day between 1 and 31),
  industry_template text not null default 'services',
  ein text,
  state_of_formation text,
  ui_mode text not null default 'simple' check (ui_mode in ('simple', 'advanced')),
  setup_completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists fin_entity_settings_org_idx on public.fin_entity_settings(organization_id);

-- -----------------------------------------------------------------------------
-- Chart of accounts
-- -----------------------------------------------------------------------------
create table if not exists public.fin_accounts (
  id uuid primary key default uuid_generate_v4(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  account_number text,
  name text not null,
  account_type text not null check (
    account_type in (
      'bank', 'accounts_receivable', 'other_current_asset', 'fixed_asset',
      'accounts_payable', 'credit_card', 'other_current_liability', 'long_term_liability',
      'equity', 'income', 'cost_of_goods_sold', 'expense', 'other_income', 'other_expense'
    )
  ),
  parent_id uuid references public.fin_accounts(id) on delete set null,
  description text,
  is_system boolean not null default false,
  is_active boolean not null default true,
  external_system text,
  external_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists fin_accounts_org_idx on public.fin_accounts(organization_id);
create index if not exists fin_accounts_type_idx on public.fin_accounts(organization_id, account_type);

-- -----------------------------------------------------------------------------
-- Bank / credit card accounts (linked to COA)
-- -----------------------------------------------------------------------------
create table if not exists public.fin_financial_accounts (
  id uuid primary key default uuid_generate_v4(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  institution text,
  account_kind text not null default 'checking' check (
    account_kind in ('checking', 'savings', 'credit_card', 'other')
  ),
  mask text,
  coa_account_id uuid references public.fin_accounts(id) on delete set null,
  opening_balance numeric not null default 0,
  opening_balance_date date,
  is_active boolean not null default true,
  plaid_item_id text,
  plaid_account_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists fin_financial_accounts_org_idx on public.fin_financial_accounts(organization_id);

-- -----------------------------------------------------------------------------
-- Accounting periods (monthly close)
-- -----------------------------------------------------------------------------
create table if not exists public.fin_periods (
  id uuid primary key default uuid_generate_v4(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  year int not null,
  month int not null check (month between 1 and 12),
  status text not null default 'open' check (status in ('open', 'in_review', 'closed')),
  closed_at timestamptz,
  closed_by_user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, year, month)
);

create index if not exists fin_periods_org_idx on public.fin_periods(organization_id, year desc, month desc);

-- -----------------------------------------------------------------------------
-- Journal entries (double-entry header)
-- -----------------------------------------------------------------------------
create table if not exists public.fin_journal_entries (
  id uuid primary key default uuid_generate_v4(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  entry_date date not null,
  memo text,
  source_type text not null default 'manual' check (
    source_type in ('manual', 'bank_transaction', 'invoice', 'purchase_order', 'import')
  ),
  source_id uuid,
  period_id uuid references public.fin_periods(id) on delete set null,
  status text not null default 'posted' check (status in ('draft', 'posted', 'void')),
  external_system text,
  external_id text,
  created_by_user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists fin_journal_entries_org_date_idx on public.fin_journal_entries(organization_id, entry_date desc);

-- -----------------------------------------------------------------------------
-- Journal lines
-- -----------------------------------------------------------------------------
create table if not exists public.fin_journal_lines (
  id uuid primary key default uuid_generate_v4(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  journal_entry_id uuid not null references public.fin_journal_entries(id) on delete cascade,
  account_id uuid not null references public.fin_accounts(id) on delete restrict,
  debit numeric not null default 0 check (debit >= 0),
  credit numeric not null default 0 check (credit >= 0),
  description text,
  financial_account_id uuid references public.fin_financial_accounts(id) on delete set null,
  project_id uuid,
  client_id uuid,
  created_at timestamptz not null default now()
);

create index if not exists fin_journal_lines_entry_idx on public.fin_journal_lines(journal_entry_id);
create index if not exists fin_journal_lines_account_idx on public.fin_journal_lines(account_id);

-- -----------------------------------------------------------------------------
-- Bank transactions (import / feed queue)
-- -----------------------------------------------------------------------------
create table if not exists public.fin_bank_transactions (
  id uuid primary key default uuid_generate_v4(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  financial_account_id uuid not null references public.fin_financial_accounts(id) on delete cascade,
  transaction_date date not null,
  description text not null default '',
  amount numeric not null,
  status text not null default 'uncategorized' check (
    status in ('uncategorized', 'categorized', 'reconciled', 'excluded')
  ),
  category_account_id uuid references public.fin_accounts(id) on delete set null,
  journal_entry_id uuid references public.fin_journal_entries(id) on delete set null,
  statement_id uuid,
  import_batch_id uuid,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists fin_bank_transactions_org_idx on public.fin_bank_transactions(organization_id, transaction_date desc);
create index if not exists fin_bank_transactions_status_idx on public.fin_bank_transactions(organization_id, status);
create index if not exists fin_bank_transactions_account_idx on public.fin_bank_transactions(financial_account_id);

-- -----------------------------------------------------------------------------
-- Uploaded bank statements (metadata)
-- -----------------------------------------------------------------------------
create table if not exists public.fin_statements (
  id uuid primary key default uuid_generate_v4(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  financial_account_id uuid not null references public.fin_financial_accounts(id) on delete cascade,
  period_start date not null,
  period_end date not null,
  opening_balance numeric,
  closing_balance numeric,
  file_path text,
  file_name text,
  parse_status text not null default 'pending' check (
    parse_status in ('pending', 'parsed', 'failed', 'reviewed')
  ),
  created_by_user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists fin_statements_org_idx on public.fin_statements(organization_id, period_end desc);

-- -----------------------------------------------------------------------------
-- Reconciliation sessions
-- -----------------------------------------------------------------------------
create table if not exists public.fin_reconciliations (
  id uuid primary key default uuid_generate_v4(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  financial_account_id uuid not null references public.fin_financial_accounts(id) on delete cascade,
  statement_id uuid references public.fin_statements(id) on delete set null,
  period_end date not null,
  statement_balance numeric not null,
  cleared_balance numeric not null default 0,
  difference numeric not null default 0,
  status text not null default 'in_progress' check (status in ('in_progress', 'balanced', 'closed')),
  completed_at timestamptz,
  created_by_user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists fin_reconciliations_org_idx on public.fin_reconciliations(organization_id);

-- -----------------------------------------------------------------------------
-- Row level security
-- -----------------------------------------------------------------------------
alter table public.fin_entity_settings enable row level security;
alter table public.fin_accounts enable row level security;
alter table public.fin_financial_accounts enable row level security;
alter table public.fin_periods enable row level security;
alter table public.fin_journal_entries enable row level security;
alter table public.fin_journal_lines enable row level security;
alter table public.fin_bank_transactions enable row level security;
alter table public.fin_statements enable row level security;
alter table public.fin_reconciliations enable row level security;

-- Helper: user's organization
create or replace function public.fin_user_org_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select organization_id from public.user_profiles where id = auth.uid() limit 1;
$$;

-- Policies: org members can read; owner/admin can write (finance module access enforced in app)
do $$
declare
  t text;
begin
  foreach t in array array[
    'fin_entity_settings', 'fin_accounts', 'fin_financial_accounts', 'fin_periods',
    'fin_journal_entries', 'fin_journal_lines', 'fin_bank_transactions',
    'fin_statements', 'fin_reconciliations'
  ]
  loop
    execute format('drop policy if exists "Finance: org select" on public.%I', t);
    execute format(
      'create policy "Finance: org select" on public.%I for select using (organization_id = public.fin_user_org_id())',
      t
    );
    execute format('drop policy if exists "Finance: org insert" on public.%I', t);
    execute format(
      'create policy "Finance: org insert" on public.%I for insert with check (organization_id = public.fin_user_org_id())',
      t
    );
    execute format('drop policy if exists "Finance: org update" on public.%I', t);
    execute format(
      'create policy "Finance: org update" on public.%I for update using (organization_id = public.fin_user_org_id())',
      t
    );
    execute format('drop policy if exists "Finance: org delete" on public.%I', t);
    execute format(
      'create policy "Finance: org delete" on public.%I for delete using (organization_id = public.fin_user_org_id())',
      t
    );
  end loop;
end $$;
