-- Link bookings back to their originating order for refund flow
-- Created: 2026-04-16

alter table public.bookings
    add column if not exists order_id bigint references public.orders(id) on delete set null;

create index if not exists bookings_order_id_idx on public.bookings (order_id);
