-- The app now saves through the device- and access-checked functions from 0035.
-- These older save functions skip those checks, so customers can no longer call them.
-- The functions stay in place; only access is removed.
revoke execute on function public.add_custom_item(uuid, text, text, uuid) from public, anon, authenticated;
revoke execute on function public.remove_custom_item(uuid) from public, anon, authenticated;
revoke execute on function public.save_custom_item_progress(uuid, boolean, text) from public, anon, authenticated;
revoke execute on function public.upsert_progress(uuid, boolean, text, uuid, uuid) from public, anon, authenticated;
