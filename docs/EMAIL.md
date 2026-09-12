# Purchase email

After a **verified** PayPal capture, `capture-paypal-order` sends mail through [Resend](https://resend.com).

## Configure

1. Create a Resend account
2. Verify your sending domain (required in production)
3. Create an API key
4. Set Edge Function secrets:

```bash
supabase secrets set RESEND_API_KEY=re_...
supabase secrets set EMAIL_FROM="Safety Prep List <info@safetypreplist.com>"
supabase secrets set SUPPORT_EMAIL=info@safetypreplist.com
supabase secrets set APP_URL=https://yourdomain.com
```

If `RESEND_API_KEY` is missing, purchase still completes; email is skipped.

## Message contents

- Safety Prep List
- Thank you for your purchase
- Plan purchased
- Product ID
- Login URL
- Device allowance
- Support address

The HTML is assembled on the server. No email keys ship to the browser.

## Support address

The public support address is `info@safetypreplist.com`. Keep `SUPPORT_EMAIL` and `VITE_SUPPORT_EMAIL` in sync.

---

# Free checklist mailing list (Brevo)

The landing-page form at **Ready when it matters** adds the visitor to your Brevo list, then lets them download `public/downloads/SafetyPrepList_EmergencyDocumentsChecklist.pdf`.

**Do not put the Brevo API key in any `VITE_` variable.** `VITE_` values are compiled into the browser bundle.

## Where the key goes

### Local preview (`npm run dev`)

1. Copy `.env.example` to `.env.local` if you have not already
2. Add:

```
BREVO_API_KEY=xkeysib-...
BREVO_LIST_ID=2
```

No `VITE_` prefix. Restart the dev server after saving.

### Live site

```bash
supabase functions deploy subscribe-checklist
supabase secrets set BREVO_API_KEY=xkeysib-...
supabase secrets set BREVO_LIST_ID=2
```

`BREVO_LIST_ID` is the number from Brevo → Contacts → Lists (in the list URL). If you omit it, the contact is still created in Brevo, but not assigned to a list.

## How to find the list ID

1. Open Brevo → Contacts → Lists
2. Open the list you want (for example “Safety Prep List”)
3. The URL looks like `.../lists/2/...` — that number is `BREVO_LIST_ID`
