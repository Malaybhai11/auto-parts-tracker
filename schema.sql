-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- RO Table
create table ro (
  id uuid primary key default uuid_generate_v4(),
  ro_number text not null unique,
  status text not null check (status in ('draft', 'finalized')) default 'draft',
  created_at timestamp with time zone default now(),
  finalized_at timestamp with time zone
);

-- Scanned Parts Table (Active/Draft)
create table ro_scanned_parts (
  id uuid primary key default uuid_generate_v4(),
  ro_id uuid not null references ro(id) on delete cascade,
  barcode_value text not null,
  quantity integer not null default 1,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),
  unique(ro_id, barcode_value)
);

-- Finalized Entries Table (Snapshot Header)
create table ro_final_entries (
  id uuid primary key default uuid_generate_v4(),
  ro_id uuid not null references ro(id),
  ro_number text not null,
  finalized_at timestamp with time zone default now()
);

-- Finalized Parts Table (Snapshot Items)
create table ro_final_parts (
  id uuid primary key default uuid_generate_v4(),
  final_entry_id uuid not null references ro_final_entries(id) on delete cascade,
  barcode_value text not null,
  quantity integer not null
);

-- Indexes for performance
create index idx_ro_ro_number on ro(ro_number);
create index idx_ro_scanned_parts_ro_id on ro_scanned_parts(ro_id);
create index idx_ro_final_entries_ro_number on ro_final_entries(ro_number);
create index idx_ro_final_parts_final_entry_id on ro_final_parts(final_entry_id);

-- RLS Policies
alter table ro enable row level security;
alter table ro_scanned_parts enable row level security;
alter table ro_final_entries enable row level security;
alter table ro_final_parts enable row level security;

create policy "Allow public read ro" on ro for select using (true);
create policy "Allow public read ro_scanned_parts" on ro_scanned_parts for select using (true);
create policy "Allow public read ro_final_entries" on ro_final_entries for select using (true);
create policy "Allow public read ro_final_parts" on ro_final_parts for select using (true);

-- RPC Function for Finalization (Transaction)
create or replace function finalize_ro(p_ro_id uuid, p_ro_number text)
returns void
language plpgsql
security definer
as $$
declare
  v_final_entry_id uuid;
begin
  -- 1. Check if RO is already finalized
  if exists (select 1 from ro where id = p_ro_id and status = 'finalized') then
    raise exception 'RO is already finalized';
  end if;

  -- 2. Create Final Entry
  insert into ro_final_entries (ro_id, ro_number, finalized_at)
  values (p_ro_id, p_ro_number, now())
  returning id into v_final_entry_id;

  -- 3. Copy parts to Final Parts
  insert into ro_final_parts (final_entry_id, barcode_value, quantity)
  select v_final_entry_id, barcode_value, quantity
  from ro_scanned_parts
  where ro_id = p_ro_id;

  -- 4. Update RO status
  update ro
  set status = 'finalized', finalized_at = now()
  where id = p_ro_id;
end;
$$;

-- Instructions:
-- 1. Go to Supabase Dashboard -> SQL Editor
-- 2. Paste this content and run it.
