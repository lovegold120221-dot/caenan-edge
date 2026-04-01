-- Caenan Calls: stores every call made by the Caenan Assistant including full artifact/knowledge data.

create table if not exists public.caenan_calls (
  id                  text primary key,                  -- Vapi call ID
  vapi_assistant_id   text,
  type                text,                              -- inboundPhoneCall | outboundPhoneCall | webCall
  status              text,
  customer_number     text,
  started_at          timestamptz,
  ended_at            timestamptz,
  duration_seconds    integer,
  recording_url       text,
  stereo_recording_url text,
  transcript_text     text,                              -- plain-text transcript from artifact
  summary             text,                              -- Vapi analysis summary if present
  cost                numeric,
  full_payload        jsonb not null default '{}',       -- complete raw Vapi call object
  synced_at           timestamptz not null default now()
);

create index if not exists caenan_calls_started_at_idx on public.caenan_calls (started_at desc);
create index if not exists caenan_calls_status_idx      on public.caenan_calls (status);

-- Per-turn transcript messages
create table if not exists public.caenan_call_messages (
  id          uuid primary key default gen_random_uuid(),
  call_id     text not null references public.caenan_calls(id) on delete cascade,
  role        text not null,   -- user | assistant | system | tool
  content     text,
  time_seconds numeric,
  seq         integer,         -- ordering within the call
  created_at  timestamptz not null default now()
);

create index if not exists caenan_call_messages_call_id_idx on public.caenan_call_messages (call_id);

-- No RLS needed — these are machine-written server-side records (service role only).
-- Grant read to anon for the local dev studio view.
alter table public.caenan_calls         enable row level security;
alter table public.caenan_call_messages enable row level security;

drop policy if exists "Service role full access on caenan_calls"         on public.caenan_calls;
drop policy if exists "Service role full access on caenan_call_messages" on public.caenan_call_messages;

create policy "Service role full access on caenan_calls"
  on public.caenan_calls for all
  using (true)
  with check (true);

create policy "Service role full access on caenan_call_messages"
  on public.caenan_call_messages for all
  using (true)
  with check (true);
