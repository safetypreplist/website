# Tawk.to live support alerts

The owner dashboard now listens to `active_support_chats` through Supabase Realtime. Tawk.to `chat:start` webhooks insert a row and `chat:end` webhooks remove it, so the dashboard alert shows the number of active chats while the owner works.

## 1. Apply the database migration

From the project root, with the Supabase CLI authenticated:

```bash
supabase db push --project-ref rhjarmxgglvwcxiwqcsq
```

This applies `supabase/migrations/0016_tawk_active_chats.sql`, enables owner-only RLS, and adds the table to the Realtime publication.

## 2. Set the webhook secret

Create a strong random secret and store it server-side. Do not put it in `.env.local`, React code, or the Tawk widget snippet.

```bash
supabase secrets set TAWK_WEBHOOK_SECRET="replace-with-a-long-random-secret" --project-ref rhjarmxgglvwcxiwqcsq
```

## 3. Deploy the Edge Function

```bash
supabase functions deploy tawk-webhook --project-ref rhjarmxgglvwcxiwqcsq --no-verify-jwt
```

The webhook URL is:

```text
https://rhjarmxgglvwcxiwqcsq.supabase.co/functions/v1/tawk-webhook
```

## 4. Configure Tawk.to

In Tawk.to, open the property with ID `6aa2dcbc8bbe9e343f3ea75a`, then go to the webhook settings and add the URL above. Use the same secret from step 2 and enable:

- Chat start
- Chat end

Tawk.to signs each request with `X-Tawk-Signature`. The Edge Function verifies the HMAC-SHA1 signature before writing anything.

## 5. What appears in the owner dashboard

When a chat starts, the owner dashboard shows an animated alert such as:

> 2 chats waiting

The alert includes the first visitor name when available and links to the Tawk.to dashboard. When Tawk.to sends the chat-end event, the count drops in real time.

Only authenticated users whose `profiles.role = 'owner'` can read `active_support_chats`.
