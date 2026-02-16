# Digit Properties — Step-by-Step Setup Guide

Follow this order for a clean, production-ready setup.

---

## 1. Environment & Repository

1. Create a new repo (e.g. `digit-properties-web`, `digit-properties-mobile`, or monorepo).
2. Create `.env.local` (and `.env.example`) with placeholders:

```env
# MongoDB Atlas
MONGODB_URI=mongodb+srv://<user>:<password>@<cluster>.mongodb.net/<db>?retryWrites=true&w=majority

# Cloudinary
NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret

# Auth (NextAuth)
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=generate_with_openssl_rand_hex_32
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
FACEBOOK_CLIENT_ID=
FACEBOOK_CLIENT_SECRET=
APPLE_CLIENT_ID=
APPLE_CLIENT_SECRET=
APPLE_PRIVATE_KEY=
APPLE_TEAM_ID=
APPLE_KEY_ID=

# Flutterwave
FLUTTERWAVE_PUBLIC_KEY=
FLUTTERWAVE_SECRET_KEY=
FLUTTERWAVE_WEBHOOK_SECRET=

# Paystack
PAYSTACK_PUBLIC_KEY=
PAYSTACK_SECRET_KEY=
PAYSTACK_WEBHOOK_SECRET=

# FCM (push)
FIREBASE_PROJECT_ID=
FIREBASE_PRIVATE_KEY=
FIREBASE_CLIENT_EMAIL=

# App URL (production)
NEXT_PUBLIC_APP_URL=https://digitproperties.com
```

3. Add `.env.local` to `.gitignore`. Never commit real keys.

---

## 2. MongoDB Atlas

1. Go to [cloud.mongodb.com](https://cloud.mongodb.com) → Create cluster (e.g. M10 for production).
2. **Security → Database Access:** Create user with read/write to your DB; note username/password.
3. **Security → Network Access:** Add IP (0.0.0.0/0 for serverless/Vercel, or your server IPs).
4. **Connect:** Get connection string; replace `<password>` and `<db>`.
5. Create collections (or let app create on first write): `users`, `listings`, `claims`, `reviews`, `alerts`, `payments`, `boosts`, `banners`, `savedsearches`.
6. Create indexes (examples):
   - `listings`: `{ status: 1, createdAt: -1 }`, `{ "location.state": 1, status: 1 }`, `{ price: 1, status: 1 }`, full-text on title/description if using Atlas Search.
   - `users`: `{ email: 1 }` unique.
   - `alerts`: `{ userId: 1 }`, `{ lastNotifiedAt: 1 }`.

---

## 3. Cloudinary

1. Sign up at [cloudinary.com](https://cloudinary.com) → Dashboard.
2. Note **Cloud name**, **API Key**, **API Secret**.
3. **Settings → Upload:** Create upload preset for listings (e.g. max width 1920, format auto, folder `listings`). Set max file size (e.g. 10MB).
4. **Security:** Restrict allowed formats (e.g. image/*, pdf). Use signed uploads from backend if you allow user uploads from client.
5. In app: upload from server using SDK; store returned `public_id` and `secure_url` in listing document.

---

## 4. Authentication (NextAuth/Auth.js)

1. Install: `npm i next-auth @auth/mongodb-adapter` (or preferred DB adapter).
2. Configure providers in `[...nextauth].ts`: Credentials (email/password with bcrypt compare), Google, Facebook, Apple. Use env vars for client ID/secret.
3. Create `User` model: email, name, image, role (guest|verified_individual|agent|developer|admin), verifiedAt, etc.
4. On first social login: create user in MongoDB; link account.
5. Protect routes: middleware that checks session; redirect to login when accessing “contact details” or dashboard. Only then render phone/email and WhatsApp button.

---

## 5. Flutterwave

1. [dashboard.flutterwave.com](https://dashboard.flutterwave.com) → API Keys (use test keys first).
2. Install SDK: `npm i flutterwave-node-v3`.
3. **Backend:** Create endpoint `POST /api/payments/flutterwave/initiate`: accept amount, currency (NGN), user id, purpose (e.g. boost_listing), reference; call Flutterwave API; return payment link or redirect URL.
4. **Webhook:** Create `POST /api/webhooks/flutterwave`: verify signature (use `FLUTTERWAVE_WEBHOOK_SECRET`), parse payload; update payment record; if success, apply boost/feature. Use idempotency (transaction id) to avoid double processing.
5. **Verify:** Optional GET endpoint to verify transaction status by ID for frontend polling.

---

## 6. Paystack

1. [dashboard.paystack.com](https://dashboard.paystack.com) → Settings → API Keys.
2. Install: `npm i paystack`.
3. **Backend:** Create `POST /api/payments/paystack/initialize`: amount (in kobo), email, reference, metadata (userId, purpose, listingId); return `authorization_url`.
4. **Webhook:** Create `POST /api/webhooks/paystack`: verify signature with `PAYSTACK_WEBHOOK_SECRET`; on `charge.success`, update payment and apply benefit (e.g. boost). Idempotent by reference.
5. Expose Paystack and Flutterwave in same “Boost listing” flow (user chooses gateway or you default one).

---

## 7. Push Notifications (FCM)

1. [Firebase Console](https://console.firebase.google.com) → Create project → Cloud Messaging.
2. **Service account:** Project settings → Service accounts → Generate key (JSON). Put `private_key`, `client_email` in env (or use JSON file only on server, never in client).
3. **Web:** Add Firebase SDK; request permission; get FCM token; send token to your API and store in `users.fcmTokens[]`.
4. **Mobile:** Configure FCM in React Native/Flutter; store device token in user profile.
5. **Backend:** When a new listing is created, run job: find saved alerts that match listing; for each user, send FCM notification (and optionally email). Use Firebase Admin SDK.

---

## 8. Admin & First User

1. In DB or via seed script: create first user with `role: 'admin'`.
2. Protect all `/admin/*` routes: middleware checks `session.user.role === 'admin'`.
3. Build admin UI: users (list, verify, suspend), listings (approve, feature, close), claims (approve/reject), banner ads, payment logs.

---

## 9. SEO & Go-Live

1. Add `next-sitemap` or custom sitemap for `/listings/[id]`, `/listings`, `/agents`, etc. Set `NEXT_PUBLIC_APP_URL=https://digitproperties.com`.
2. Submit sitemap in Google Search Console for digitproperties.com.
3. Add AdSense script and ad units only where compliant (e.g. public listing pages, not inside dashboards).
4. Enable security headers (CSP, HSTS) and run a security pass (no secrets in client, rate limits, validation).

---

## 10. Deployment

- **Web:** Vercel (recommended for Next.js). Set all env vars in project settings. Point domain digitproperties.com to Vercel.
- **Mobile:** Build with EAS (Expo) or Flutter build; submit to App Store and Google Play.
- **Webhooks:** Set Flutterwave and Paystack webhook URLs to `https://digitproperties.com/api/webhooks/flutterwave` and `.../paystack`. Use production secrets.

---

Once these steps are done, you have a solid base to implement the rest of the specification (claim flow, ratings, badges, WhatsApp, boost UI, banner ads) on top of this setup.
