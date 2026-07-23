-- ============================================================
--  நல்ல நேரம் Pro — Supabase schema + Row-Level Security
--  AUTH: Clerk (Supabase is DB-only). RLS keys on the Clerk user id (text),
--  read from the Clerk-issued JWT claim `sub`.
--  Run in: Supabase dashboard → SQL Editor → New query → Run
-- ============================================================

-- Helper: the Clerk user id of the caller, taken from the verified JWT.
-- (Requires Clerk configured as a third-party auth provider in Supabase — see README.)
create or replace function public.requesting_user_id()
returns text language sql stable as $$
  select nullif(auth.jwt() ->> 'sub', '')::text;
$$;

-- ---------- 1. SUBSCRIPTIONS -------------------------------------------------
-- One row per user, kept in sync by the Stripe webhook. Single source of truth
-- for "is this user Pro?". The browser only ever READS it.
create table if not exists public.subscriptions (
  user_id                text primary key,          -- Clerk user id, e.g. user_2ab...
  stripe_customer_id     text unique,
  stripe_subscription_id text unique,
  status                 text not null default 'none', -- none|trialing|active|past_due|canceled
  price_id               text,
  current_period_end     timestamptz,
  cancel_at_period_end   boolean default false,
  updated_at             timestamptz not null default now()
);

-- ---------- 2. FAMILY PROFILES ----------------------------------------------
-- Replaces the localStorage family list. Birth details only — no readings are
-- stored; the client recomputes those from the engine each time.
create table if not exists public.profiles (
  id          uuid primary key default gen_random_uuid(),
  user_id     text not null,               -- Clerk user id
  name        text not null,
  dob         date not null,               -- date of birth
  tob         time not null,               -- time of birth
  city_label  text,                        -- e.g. "சென்னை (Chennai)"
  lat         double precision,
  lon         double precision,
  tz          double precision,            -- UTC offset used at birth
  tz_name     text,                        -- IANA zone, e.g. Asia/Kolkata
  created_at  timestamptz not null default now()
);
create index if not exists profiles_user_idx on public.profiles(user_id);

-- ---------- 3. JATHAGAM ENQUIRIES -------------------------------------------
-- Consultation form. Insert-only for users; the astrologer reads via the
-- service role / a protected admin view.
create table if not exists public.enquiries (
  id          uuid primary key default gen_random_uuid(),
  ref         text unique not null,        -- e.g. NN-20260722-K4T9
  user_id     text,                        -- Clerk user id, or null for guests
  name        text not null,
  email       text not null,
  phone       text,
  dob         date,
  tob         time,
  city_label  text,
  message     text,
  consent     boolean not null default false,
  status      text not null default 'new', -- new|contacted|closed
  created_at  timestamptz not null default now()
);

-- ============================================================
--  ROW-LEVEL SECURITY — Postgres blocks cross-user access.
-- ============================================================
alter table public.subscriptions enable row level security;
alter table public.profiles      enable row level security;
alter table public.enquiries     enable row level security;

-- subscriptions: read only your own row. Writes are webhook-only (service role,
-- which bypasses RLS).
drop policy if exists "read own subscription" on public.subscriptions;
create policy "read own subscription" on public.subscriptions
  for select using (user_id = public.requesting_user_id());

-- profiles: full CRUD, but only your own rows.
drop policy if exists "own profiles select" on public.profiles;
create policy "own profiles select" on public.profiles
  for select using (user_id = public.requesting_user_id());
drop policy if exists "own profiles insert" on public.profiles;
create policy "own profiles insert" on public.profiles
  for insert with check (user_id = public.requesting_user_id());
drop policy if exists "own profiles update" on public.profiles;
create policy "own profiles update" on public.profiles
  for update using (user_id = public.requesting_user_id())
             with check (user_id = public.requesting_user_id());
drop policy if exists "own profiles delete" on public.profiles;
create policy "own profiles delete" on public.profiles
  for delete using (user_id = public.requesting_user_id());

-- enquiries: anyone (signed-in or guest) may submit; nobody reads back via the
-- public API. The astrologer reads with the service role or SQL editor.
drop policy if exists "anyone can submit enquiry" on public.enquiries;
create policy "anyone can submit enquiry" on public.enquiries
  for insert with check (true);

-- ============================================================
--  is_pro() helper usable in Postgres / views.
-- ============================================================
create or replace function public.is_pro(uid text)
returns boolean language sql stable as $$
  select exists (
    select 1 from public.subscriptions s
    where s.user_id = uid
      and s.status in ('active','trialing')
      and (s.current_period_end is null or s.current_period_end > now())
  );
$$;
