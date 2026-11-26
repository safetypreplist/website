-- Retire owner-saved copy left over from the account-based app.
-- The app already ignores these lines client-side; this cleans the stored config.

-- Guided Tour: the saved 5-step script mentions accounts, passwords, "Manage Family Plan",
-- and "Checklist ID", and no longer lines up with today's 9 stops. An empty list makes the
-- app use its built-in local-first copy. Owners can still customize stops in Admin → Onboarding.
update public.app_config
set value = '[]'::jsonb
where key = 'onboarding_copy';

-- Help FAQs: drop the custom "family" (Manage Family Plan) and "devices" (Each login / My Devices) entries.
update public.app_config
set value = coalesce(
  (
    select jsonb_agg(item)
    from jsonb_array_elements(value) as item
    where coalesce(item ->> 'id', '') not in ('family', 'devices')
  ),
  '[]'::jsonb
)
where key = 'help_faqs'
  and jsonb_typeof(value) = 'array';
