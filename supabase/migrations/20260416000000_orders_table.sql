-- Orders table: records all WeChat Pay transactions
-- Created: 2026-04-16

create table if not exists public.orders (
    id              bigserial primary key,
    out_trade_no    text unique not null,           -- our order number sent to WeChat
    prepay_id       text,                            -- WeChat's prepay_id returned from unified order
    transaction_id  text,                            -- WeChat's transaction_id (filled on paid)
    user_id         bigint not null,                 -- references users.id
    openid          text,                            -- WeChat openid at time of payment
    type            text not null,                   -- 'course' | 'coach' | 'table' | 'activity'
    target_id       bigint,                          -- id of course/coach/activity/booking
    description     text not null,                   -- human-readable description
    amount          integer not null,                -- amount in fen (cents). 80元 = 8000
    status          text not null default 'pending', -- 'pending' | 'paid' | 'refunding' | 'refunded' | 'failed' | 'cancelled'
    refund_amount   integer default 0,               -- refunded amount in fen
    refund_no       text,                            -- our refund number
    refund_id       text,                            -- WeChat's refund_id
    metadata        jsonb default '{}'::jsonb,       -- any extra context (booking slots, activity data, etc.)
    paid_at         timestamptz,
    refunded_at     timestamptz,
    created_at      timestamptz not null default now(),
    updated_at      timestamptz not null default now()
);

create index if not exists orders_user_id_idx on public.orders (user_id);
create index if not exists orders_status_idx on public.orders (status);
create index if not exists orders_out_trade_no_idx on public.orders (out_trade_no);
create index if not exists orders_type_idx on public.orders (type);

-- Auto-update updated_at on row change
create or replace function public.orders_set_updated_at()
returns trigger as $$
begin
    new.updated_at = now();
    return new;
end;
$$ language plpgsql;

drop trigger if exists orders_updated_at_trigger on public.orders;
create trigger orders_updated_at_trigger
    before update on public.orders
    for each row execute function public.orders_set_updated_at();

-- RLS: users can read their own orders; service role bypasses
alter table public.orders enable row level security;

drop policy if exists "users_read_own_orders" on public.orders;
create policy "users_read_own_orders" on public.orders
    for select using (true); -- app uses phone-based auth, not Supabase auth; gate in app layer

drop policy if exists "service_role_full_access_orders" on public.orders;
create policy "service_role_full_access_orders" on public.orders
    for all using (auth.role() = 'service_role');
