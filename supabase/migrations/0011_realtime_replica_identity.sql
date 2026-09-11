-- Realtime UPDATE/DELETE payloads need full row data so checklist
-- checks and contacts do not apply a partial (unchecked) row.

alter table public.checklist_progress replica identity full;
alter table public.contacts replica identity full;
alter table public.custom_checklist_items replica identity full;
alter table public.devices replica identity full;
