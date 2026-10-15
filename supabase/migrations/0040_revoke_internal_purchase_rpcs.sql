-- These functions grant purchases, seats, devices and checklists. Only payment code
-- (running as service_role) and other security-definer functions should call them.
-- Supabase gives anon and authenticated execute on new functions by default, so
-- customers could call them directly. The functions stay in place; only access is removed.
revoke all on function public.apply_purchase_entitlements(uuid) from public, anon, authenticated;
revoke all on function public.provision_purchase_checklists(uuid, uuid) from public, anon, authenticated;
revoke all on function public.record_access_from_purchase(uuid) from public, anon, authenticated;
revoke all on function public.increment_discount_redemption(text) from public, anon, authenticated;
revoke all on function public.ensure_personal_checklist(uuid) from public, anon, authenticated;
revoke all on function public.ensure_plan_group(uuid) from public, anon, authenticated;

grant execute on function public.apply_purchase_entitlements(uuid) to service_role;
grant execute on function public.provision_purchase_checklists(uuid, uuid) to service_role;
grant execute on function public.record_access_from_purchase(uuid) to service_role;
grant execute on function public.increment_discount_redemption(text) to service_role;
grant execute on function public.ensure_personal_checklist(uuid) to service_role;
grant execute on function public.ensure_plan_group(uuid) to service_role;
