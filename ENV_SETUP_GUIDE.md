# Step-by-Step Guide: Obtaining All Environment Variables

This guide walks you through getting every value needed for `web/.env.local`.

---

## 1. MongoDB Atlas

**What you get:** `MONGODB_URI`

1. Go to [https://www.mongodb.com/cloud/atlas](https://www.mongodb.com/cloud/atlas) and sign up or log in.
2. Create a **New Project** (e.g. "Digit-Properties").
3. Click **Build a Database** → choose **M0 Free** → pick a region near you → Create.
4. Create a database user:
   - **Database Access** → **Add New Database User**
   - Choose **Password** auth, set username and password, save.
5. Allow network access:
   - **Network Access** → **Add IP Address** → **Allow Access from Anywhere** (or add your IP) → Confirm.
6. Get the connection string:
   - **Database** → **Connect** on your cluster → **Connect your application**
   - Copy the URI. It looks like:  
     `mongodb+srv://<username>:<password>@cluster0.xxxxx.mongodb.net/<dbname>?retryWrites=true&w=majority`
7. Replace `<username>`, `<password>`, and `<dbname>` with your DB user and desired database name.  
   **Important:** If the password has special characters, URL-encode them (e.g. `@` → `%40`).

**In `.env.local`:**
```env
MONGODB_URI=mongodb+srv://YOUR_USER:YOUR_PASSWORD@YOUR_CLUSTER.mongodb.net/YOUR_DB?retryWrites=true&w=majority
```

---

## 2. Cloudinary

**What you get:** `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`

1. Go to [https://cloudinary.com](https://cloudinary.com) and sign up (free tier available).
2. After login, open the **Dashboard**.
3. On the dashboard you’ll see:
   - **Cloud name**
   - **API Key**
   - **API Secret** (click “Reveal” to see it)
4. Copy these three values into `.env.local`. Never expose the API secret in frontend code.

**In `.env.local`:**
```env
NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret
```

---

## 3. NextAuth (Auth)

**What you get:** `NEXTAUTH_URL`, `NEXTAUTH_SECRET`, and OAuth credentials for Google, Facebook, Apple.

### 3a. NEXTAUTH_URL & NEXTAUTH_SECRET

- **NEXTAUTH_URL:** Use `http://localhost:3000` for local dev. In production use your real URL (e.g. `https://yourdomain.com`).
- **NEXTAUTH_SECRET:** Generate a random string. Options:
  - **PowerShell:** `[Convert]::ToBase64String((1..32 | ForEach-Object { Get-Random -Maximum 256 }) -as [byte[]])`
  - **OpenSSL (if installed):** `openssl rand -hex 32`
  - Or use: [https://generate-secret.vercel.app/32](https://generate-secret.vercel.app/32)

### 3b. Google OAuth

1. Go to [Google Cloud Console](https://console.cloud.google.com/).
2. Create or select a project.
3. **APIs & Services** → **Credentials** → **Create Credentials** → **OAuth client ID**.
4. If prompted, configure the **OAuth consent screen** (External, add your email, app name, save).
5. Application type: **Web application**.
6. Add **Authorized redirect URIs:**  
   - Local: `http://localhost:3000/api/auth/callback/google`  
   - Production: `https://digitproperties.com/api/auth/callback/google`
7. Create → copy **Client ID** and **Client Secret**.

**In `.env.local`:**
```env
GOOGLE_CLIENT_ID=xxxxx.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-xxxxx
```

### 3c. Facebook Login

1. Go to [Facebook Developers](https://developers.facebook.com/) → **My Apps** → **Create App** (or use existing).
2. Add product **Facebook Login** → **Settings**.
3. Copy **App ID** and **App Secret**.
4. Ensure **Client OAuth Login** and **Web OAuth Login** are both **ON**.
5. **Valid OAuth Redirect URIs** add:  
   - Local: `http://localhost:3000/api/auth/callback/facebook`  
   - Production: `https://digitproperties.com/api/auth/callback/facebook`

**In `.env.local`:**
```env
FACEBOOK_CLIENT_ID=your_app_id
FACEBOOK_CLIENT_SECRET=your_app_secret
```

### 3d. Sign in with Apple

1. [Apple Developer](https://developer.apple.com/) account (paid membership required).
2. **Certificates, Identifiers & Profiles** → **Identifiers** → **+** → **App IDs** → create or select your app.
3. Enable **Sign in with Apple** for that App ID.
4. **Keys** → **+** → create a key, enable **Sign in with Apple** → note **Key ID** and download the **.p8** file (private key).
5. **Certificates, Identifiers & Profiles** → **Identifiers** → **Services IDs** → create a Services ID (e.g. for web). Configure **Sign in with Apple** and set redirect URL:  
   `https://yourdomain.com/api/auth/callback/apple` (and localhost if needed).
6. You need: **Team ID**, **Client ID** (Services ID), **Key ID**, **Private Key** (contents of .p8).  
   For NextAuth, the private key is often set as `APPLE_PRIVATE_KEY`; your template uses `APPLE_CLIENT_SECRET` — some setups put the .p8 contents there or in a dedicated var. Check your NextAuth Apple provider docs.

**In `.env.local`:**
```env
APPLE_CLIENT_ID=your_services_id
APPLE_CLIENT_SECRET=contents_of_p8_file_or_special_format
APPLE_TEAM_ID=XXXXXXXX
APPLE_KEY_ID=YYYYYYYY
```

*(If your app doesn’t use Apple login yet, you can leave these blank.)*

---

## 4. Flutterwave

**What you get:** `NEXT_PUBLIC_FLUTTERWAVE_PUBLIC_KEY`, `FLUTTERWAVE_SECRET_KEY`, `FLUTTERWAVE_WEBHOOK_SECRET`

1. Go to [https://flutterwave.com](https://flutterwave.com) and sign up (Nigeria and other African markets).
2. Complete verification (KYC) to get live keys.
3. **Settings** → **API Keys** (or **Developers** → **API Keys**).
4. Copy:
   - **Public key** → `NEXT_PUBLIC_FLUTTERWAVE_PUBLIC_KEY`
   - **Secret key** → `FLUTTERWAVE_SECRET_KEY`
5. For webhooks:
   - **Webhooks** (or Developers → Webhooks) → add endpoint:  
     `https://yourdomain.com/api/webhooks/flutterwave`  
   - Flutterwave may show a **Webhook secret** or **Verification hash** — use that as `FLUTTERWAVE_WEBHOOK_SECRET`. If they only give a “secret” or “hash”, use that value.

**In `.env.local`:**
```env
NEXT_PUBLIC_FLUTTERWAVE_PUBLIC_KEY=FLWPUBK-xxxxx
FLUTTERWAVE_SECRET_KEY=FLWSECK-xxxxx
FLUTTERWAVE_WEBHOOK_SECRET=your_webhook_secret_or_hash
```

---

## 5. Paystack

**What you get:** `NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY`, `PAYSTACK_SECRET_KEY`, `PAYSTACK_WEBHOOK_SECRET`

1. Go to [https://paystack.com](https://paystack.com) and sign up (Nigeria-focused).
2. Complete verification to go live.
3. **Settings** → **API Keys & Webhooks**.
4. On the **API Configuration** page you’ll see:
   - **Live / Test Public Key** → `NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY` (e.g. `pk_live_...` or `pk_test_...`)
   - **Live / Test Secret Key** → `PAYSTACK_SECRET_KEY` (click to reveal or “Generate new secret key” if needed)
   - **Live / Test Webhook URL** → set to `https://www.digitproperties.com/api/webhooks/paystack` (or your app URL) and click **Save changes**
   - **Live / Test Callback URL** → optional; set if your app uses redirect callbacks (e.g. `https://www.digitproperties.com/callback/`)
5. **There is no separate “Webhook secret” on Paystack.** Webhooks are signed with your **Secret Key**. Paystack sends an `x-paystack-signature` header (HMAC SHA512 of the body using your secret key). Your backend should verify that header using `PAYSTACK_SECRET_KEY`. So either:
   - Use **only** `PAYSTACK_SECRET_KEY` in your webhook handler for verification, and leave `PAYSTACK_WEBHOOK_SECRET` empty or omit it, **or**
   - If your code expects a variable named `PAYSTACK_WEBHOOK_SECRET`, set it to the **same value** as `PAYSTACK_SECRET_KEY`.

**In `.env.local`:**
```env
NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY=pk_live_xxxxx
PAYSTACK_SECRET_KEY=sk_live_xxxxx
# No separate webhook secret; use PAYSTACK_SECRET_KEY for x-paystack-signature verification
PAYSTACK_WEBHOOK_SECRET=sk_live_xxxxx
```
*(Use the same secret key for `PAYSTACK_WEBHOOK_SECRET` as for `PAYSTACK_SECRET_KEY`, or leave it unset if your handler only uses the secret key.)*

---

## 6. Firebase (FCM – Push Notifications)

**What you get:** `FIREBASE_PROJECT_ID`, `FIREBASE_PRIVATE_KEY`, `FIREBASE_CLIENT_EMAIL`

1. Go to [Firebase Console](https://console.firebase.google.com/).
2. Create a project or select existing one. Note the **Project ID** → `FIREBASE_PROJECT_ID`.
3. **Project Settings** (gear) → **Service accounts**.
4. Click **Generate new private key** (creates a JSON file).
5. Open the JSON. You need:
   - `project_id` → `FIREBASE_PROJECT_ID`
   - `private_key` → `FIREBASE_PRIVATE_KEY` (full key including `-----BEGIN PRIVATE KEY-----` and `-----END PRIVATE KEY-----`; in `.env` you often need to replace real newlines with `\n` or keep it on one line depending on your app’s env parser).
   - `client_email` → `FIREBASE_CLIENT_EMAIL`

**In `.env.local`:**
```env
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@your-project-id.iam.gserviceaccount.com
```

*(If you don’t use push notifications yet, these can stay empty.)*

---

## 7. App URL

**What you get:** `NEXT_PUBLIC_APP_URL`

- **Local:** `http://localhost:3000`
- **Production:** `https://yourdomain.com` (no trailing slash).

**In `.env.local`:**
```env
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

---

## Quick Checklist

| Variable | Where to get it |
|----------|-----------------|
| `MONGODB_URI` | MongoDB Atlas → Connect → connection string |
| `NEXT_PUBLIC_CLOUDINARY_*` / `CLOUDINARY_*` | Cloudinary Dashboard |
| `NEXTAUTH_URL` | Your app URL (localhost or production) |
| `NEXTAUTH_SECRET` | Generate (PowerShell/OpenSSL/online) |
| `GOOGLE_CLIENT_*` | Google Cloud Console → Credentials → OAuth client |
| `FACEBOOK_CLIENT_*` | Facebook Developers → App → Settings |
| `APPLE_*` | Apple Developer → Identifiers, Keys, Services ID |
| `FLUTTERWAVE_*` | Flutterwave Dashboard → API Keys & Webhooks |
| `PAYSTACK_*` | Paystack Dashboard → API Keys & Webhooks (no separate webhook secret; use Secret Key for verification) |
| `FIREBASE_*` | Firebase Console → Project Settings → Service account JSON |
| `NEXT_PUBLIC_APP_URL` | Your app’s public URL |

---

## Security Reminders

- Never commit `.env.local` to Git (it should be in `.gitignore`).
- Use **test/sandbox** keys for development when available (e.g. Paystack test keys, Flutterwave test mode).
- In production, set these in your host’s environment (e.g. Vercel, Railway) instead of in the repo.
