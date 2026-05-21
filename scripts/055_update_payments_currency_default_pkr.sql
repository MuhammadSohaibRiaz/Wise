-- Align payments currency default with WiseCase Pakistan payment flow.
-- Safe to run repeatedly.
alter table public.payments
  alter column currency set default 'PKR';
