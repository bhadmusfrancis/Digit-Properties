# Digit Properties — Web App

Production-ready real estate platform for Nigeria. Buy, sell, and rent properties with Zillow-standard quality.

## Tech Stack

- **Next.js 14** (App Router), TypeScript, Tailwind CSS
- **MongoDB Atlas** (Mongoose)
- **Cloudinary** (images)
- **NextAuth** (credentials + Google)
- **Flutterwave & Paystack** (payments)
- **React Query** (data fetching)

## Setup

### 1. Environment

Copy `.env.example` to `.env.local` and fill in:

```env
# Required
MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net/digitproperties
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=your_secret_openssl_rand_hex_32

# Cloudinary
NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME=...
CLOUDINARY_API_KEY=...
CLOUDINARY_API_SECRET=...

# Optional: Auth
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...

# Optional: Payments
NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY=...
PAYSTACK_SECRET_KEY=...
PAYSTACK_WEBHOOK_SECRET=...
NEXT_PUBLIC_FLUTTERWAVE_PUBLIC_KEY=...
FLUTTERWAVE_SECRET_KEY=...
FLUTTERWAVE_WEBHOOK_SECRET=...
```

### 2. MongoDB Atlas

1. Create a cluster at [cloud.mongodb.com](https://cloud.mongodb.com)
2. Add database user and network access (0.0.0.0/0 for Vercel)
3. Create database `digitproperties`
4. Indexes are created automatically by Mongoose schemas

### 3. Cloudinary

1. Sign up at [cloudinary.com](https://cloudinary.com)
2. Create upload preset for listings (max 10MB, folder `listings`)
3. Add credentials to `.env.local`

### 4. Install & Run

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### 5. First Admin User

```bash
ADMIN_EMAIL=admin@example.com ADMIN_PASSWORD=YourPassword123 npm run seed
```

Or use MongoDB Compass to set `role: 'admin'` on a user.

### 6. Payment Webhooks (Production)

- **Paystack:** `https://yourdomain.com/api/webhooks/paystack`
- **Flutterwave:** `https://yourdomain.com/api/webhooks/flutterwave`

Set these in each payment dashboard and use the webhook secret in env.

## Features

- **Listings:** Sale/Rent, full fields, status (Draft/Active/Paused/Closed), Cloudinary images
- **Contact visibility:** Phone/email/agent only after login
- **WhatsApp CTA:** Pre-filled message with listing link
- **User levels:** Guests, Verified Individual, Registered Agent, Registered Developer, Admin
- **Badges:** Shown on listing cards and profiles
- **Claim property:** Admin/AI listings can be claimed by verified users
- **Ratings:** After Sold/Rented, counterparty can rate the lister
- **Alerts:** Saved searches with push/email notifications (FCM + email)
- **Boost listing:** Pay via Paystack/Flutterwave for "Sponsored" badge
- **Banner ads:** Admin-assigned slots
- **SEO:** Meta tags, Open Graph, sitemaps

## Project Structure

```
src/
  app/          # App Router pages & API routes
  components/   # React components
  lib/          # DB, auth, utils
  models/       # Mongoose models
```

## Deployment (Vercel)

1. Connect repo to Vercel
2. Add all env vars
3. Deploy

Sitemap is generated at build time (`next-sitemap`).
