# Email Setup Guide (Resend)

This guide covers setting up transactional emails with Resend for Digit Properties.

## Overview

The app sends these emails:

| Event | Recipient | Description |
|-------|-----------|-------------|
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
```

- **RESEND_API_KEY**: Required for sending emails. Without it, emails are skipped (no errors).
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

- **Signup**: Register a new account → you receive welcome email, admin receives notification
- **Claim**: Submit a claim as a verified user → admin receives claim notification
- **Claim approval**: Approve/reject as admin → claimant receives email
- **New listing**: Publish a listing → admin receives notification
- **Alerts**: Create an alert with filters, then publish a matching listing → user receives alert email

## Troubleshooting

- **Emails not sending**: Check `RESEND_API_KEY` is set and valid
- **"Domain not verified"**: Complete DNS setup in Resend for your domain
- **Admin not receiving**: Ensure `ADMIN_EMAIL` is correct (default: contact@digitproperties.com)
- **Logs**: Check server logs for `[email]` or `[register]`, `[claims]`, `[listings]` errors
