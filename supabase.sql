-- Run this once in Supabase → SQL Editor → New query → paste → Run.
create table if not exists public.purchases (
  id           uuid primary key default gen_random_uuid(),
  order_id     text unique not null,
  payment_id   text,
  status       text not null default 'created',
  access_token text unique,
  amount       integer,
  created_at   timestamptz default now()
);

-- Lock the table down. With RLS on and no policies, the public/anon key
-- cannot read or write it. Only the server (using the service role key)
-- can, which is exactly what we want.
alter table public.purchases enable row level security;
