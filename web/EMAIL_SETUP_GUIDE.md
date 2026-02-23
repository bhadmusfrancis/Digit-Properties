# Email Setup Guide (Resend)

This guide covers setting up transactional emails with Resend for Digit Properties.

## Overview

The app sends these emails:

| Event | Recipient | Description |
|-------|-----------|-------------|
| **User signup** | User | Email verification link (required for credentials signup) |
| **User signup** | User | Welcome email |
| **User signup** | Admin (contact@digitproperties.com) | New user notification |
| **Claim submitted** | Admin | New listing claim to review |
| **Claim approved** | Claimant | Notification that claim was approved |
| **Claim rejected** | Claimant | Notification with reason |
| **New listing published** | Admin | New listing notification |
| **Saved search match** | User | New listings matching their alert |

## 1. Get Your Resend API Key

1. Go to [resend.com](https://resend.com) and sign in (or create an account)
2. Add and verify your domain: `digitproperties.com`
   - In Resend Dashboard → Domains → Add domain
   - Add the DNS records (MX, DKIM) as instructed
3. Create an API key: API Keys → Create API Key
4. Copy the key (starts with `re_`)

## 2. Configure Environment Variables

Add to your `.env.local` (and production env on Vercel):

```env
# Required
RESEND_API_KEY=re_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# Optional (defaults shown)
ADMIN_EMAIL=contact@digitproperties.com
FROM_EMAIL=Digit Properties <noreply@digitproperties.com>

# Use this until your domain is verified (no DNS needed):
RESEND_FROM_OVERRIDE=Digit Properties <onboarding@resend.dev>
```

- **RESEND_API_KEY**: **Required** for sending emails. Without it, emails are skipped (no errors in the API, but admin and new members will not receive any emails, and new users will not receive the verification link and cannot sign in until you set it and they request a new link or you mark them verified in the DB).
- **ADMIN_EMAIL**: All admin notifications go here. Default: `contact@digitproperties.com`
- **FROM_EMAIL**: Sender for all outgoing emails. Must use a verified domain (e.g. `noreply@digitproperties.com`).

## 3. Verify Domain in Resend

For `digitproperties.com`:

1. In Resend: Domains → Add Domain → `digitproperties.com`
2. Add the DNS records to your domain provider (Namecheap, etc.):
   - **MX**: As shown in Resend
   - **DKIM**: CNAME records as shown
3. Wait for verification (can take a few minutes)

## 4. Vercel Production Setup

1. Vercel Dashboard → Project → Settings → Environment Variables
2. Add:
   - `RESEND_API_KEY` (production)
   - `ADMIN_EMAIL` = `contact@digitproperties.com` (optional)
   - `FROM_EMAIL` = `Digit Properties <noreply@digitproperties.com>` (optional)

## 5. Test Emails

- **Signup**: Register a new account (email/password) → user receives **verification email** and welcome email; admin receives new user notification. User must click the verification link before they can sign in.
- **Claim**: Submit a claim as a verified user → admin receives claim notification
- **Claim approval**: Approve/reject as admin → claimant receives email
- **New listing**: Publish a listing → admin receives notification
- **Alerts**: Create an alert with filters, then publish a matching listing → user receives alert email

## Troubleshooting

- **Emails not sending**: Check `RESEND_API_KEY` is set in **web** `.env.local` (or production env). Restart the dev server after changing env. Then go to **Admin → Emails** and click **Send test email** to see the exact error (e.g. domain not verified).
- **"Domain not verified"**: The address in `FROM_EMAIL` (e.g. `noreply@digitproperties.com`) must use a **verified domain** in Resend. You have two options:
  1. **Quick fix (no DNS):** In `.env.local` add `RESEND_FROM_OVERRIDE=Digit Properties <onboarding@resend.dev>`. Restart the server. Emails will send from Resend’s test address until you verify your domain.
  2. **Production:** Go to [Resend → Domains](https://resend.com/domains), add `digitproperties.com`, add the DNS records they show (MX + DKIM), wait for verification, then remove `RESEND_FROM_OVERRIDE` so the app uses `FROM_EMAIL`.
- **Admin not receiving**: Ensure `ADMIN_EMAIL` is correct (default: contact@digitproperties.com) and that your inbox isn’t filtering the test/signup emails.
- **Logs**: Check server logs for `[email] Resend error:` or `[email] Send failed:` to see the raw Resend response.
