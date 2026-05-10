-- =============================================
-- Extend notifications enum-like constraint
-- Allows system + payment events
-- =============================================

alter table public.notifications
drop constraint if exists notifications_type_check;

alter table public.notifications
add constraint notifications_type_check
check (
  type in (
    'system',
    'message',
    'appointment_request',
    'appointment_update',
    'case_update',
    'payment_update'
  )
);

comment on constraint notifications_type_check on public.notifications is
  'Valid notification types including system + payment events';


