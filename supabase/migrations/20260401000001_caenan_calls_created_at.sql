-- Add created_at to caenan_calls (was accidentally omitted; synced_at is when it was synced,
-- created_at represents when the call was initiated — maps to started_at or now() as fallback).

alter table public.caenan_calls
  add column if not exists created_at timestamptz not null default now();

-- Back-fill from started_at where available
update public.caenan_calls
  set created_at = coalesce(started_at, synced_at)
  where created_at = synced_at;

create index if not exists caenan_calls_created_at_idx on public.caenan_calls (created_at desc);
