# Hosting & Domain Setup – digitproperties.com

Guide to host your app on **digitproperties.com** (domain purchased on Namecheap).

---

## Overview

1. Deploy the web app to **Vercel** (free for Next.js)
2. Connect your **Namecheap** domain to Vercel
3. Set production environment variables
4. Add OAuth redirect URIs in Google, Facebook, Apple

---

## Step 1: Deploy to Vercel

1. Go to [vercel.com](https://vercel.com) and sign up (or log in with GitHub).
2. Click **Add New** → **Project**.
3. Import your repository (push your code to GitHub first if needed).
4. **Root Directory:** Set to `web` (your Next.js app is in the `web` folder).
5. **Framework Preset:** Next.js (auto-detected).
6. Do **not** deploy yet—add environment variables first (Step 3).

---

## Step 2: Connect Namecheap Domain to Vercel

### 2a. Add domain in Vercel

1. In your Vercel project → **Settings** → **Domains**.
2. Add: `digitproperties.com` and `www.digitproperties.com`.
3. Vercel will show DNS records you need to configure.

### 2b. Configure DNS in Namecheap

1. Log in to [Namecheap](https://www.namecheap.com) → **Domain List** → **Manage** for digitproperties.com.
2. Go to **Advanced DNS**.
3. Add/update records as follows:

| Type | Host | Value | TTL |
|------|------|-------|-----|
| **A** | `@` | `76.76.21.21` | Automatic |
| **CNAME** | `www` | `cname.vercel-dns.com` | Automatic |

   Or if Vercel shows different values, use those instead.

4. Remove any conflicting records (e.g. URL Redirect for `@` if it clashes).
5. Save changes. DNS propagation can take from a few minutes to 48 hours.

### 2c. Verify in Vercel

- Vercel will verify the domain. When it shows a green checkmark, the domain is active.

---

## Step 3: Set Production Environment Variables

In Vercel: **Project** → **Settings** → **Environment Variables**.

Add all variables from `web/.env.production.example`. Key ones for production:

| Variable | Value (example) |
|----------|-----------------|
| `NEXTAUTH_URL` | `https://digitproperties.com` |
| `NEXT_PUBLIC_APP_URL` | `https://digitproperties.com` |
| `MONGODB_URI` | Your MongoDB Atlas connection string |
| `NEXTAUTH_SECRET` | Generate with `openssl rand -hex 32` |
| `GOOGLE_CLIENT_ID` | (same as local) |
| `GOOGLE_CLIENT_SECRET` | (same as local) |
| `FACEBOOK_CLIENT_ID` | (same as local) |
| `FACEBOOK_CLIENT_SECRET` | (same as local) |
| `CLOUDINARY_*` | (same as local) |
| `PAYSTACK_*`, `FLUTTERWAVE_*` | Your production keys |

Apply to **Production** environment. Redeploy after adding/updating variables.

---

## Step 4: OAuth Redirect URIs (Production)

Add these **in addition to** your localhost URIs (keep both for dev + prod).

### Google Cloud Console

1. [console.cloud.google.com](https://console.cloud.google.com/) → **APIs & Services** → **Credentials**.
2. Open your OAuth 2.0 Client ID.
3. **Authorized redirect URIs** → Add:
   ```
   https://digitproperties.com/api/auth/callback/google
   ```

### Facebook Developer Console

1. [developers.facebook.com](https://developers.facebook.com/) → Your app → **Facebook Login** → **Settings**.
2. **Valid OAuth Redirect URIs** → Add:
   ```
   https://digitproperties.com/api/auth/callback/facebook
   ```

### Apple (if used)

In Apple Developer → Services ID → **Sign in with Apple** configuration, add:
```
https://digitproperties.com/api/auth/callback/apple
```

---

## Step 5: Payment Webhooks

Set webhook URLs in Flutterwave and Paystack:

- **Paystack:** `https://digitproperties.com/api/webhooks/paystack`
- **Flutterwave:** `https://digitproperties.com/api/webhooks/flutterwave`

---

## Step 6: Redeploy

After DNS, env vars, and OAuth are configured:

1. Vercel → **Deployments** → **Redeploy** (or push a new commit).
2. Visit `https://digitproperties.com` to verify.

---

## Checklist

- [ ] Code pushed to GitHub
- [ ] Vercel project created (root: `web`)
- [ ] Namecheap DNS: A + CNAME records added
- [ ] Vercel domain verified
- [ ] Production env vars set in Vercel
- [ ] Google redirect URI: `https://digitproperties.com/api/auth/callback/google`
- [ ] Facebook redirect URI: `https://digitproperties.com/api/auth/callback/facebook`
- [ ] Paystack/Flutterwave webhook URLs updated
- [ ] Redeploy
