# Digit Properties

Production-ready real estate platform for **Nigeria**. Buy, Sell, and Rent/Lease properties with Zillow-standard quality.

- **Website:** [digitproperties.com](https://digitproperties.com)
- **Web app:** Next.js 14, TypeScript, Tailwind, MongoDB, Cloudinary
- **Mobile app:** React Native / Expo

## Quick Start

### Web App

```bash
cd web
cp .env.example .env.local
# Edit .env.local with MongoDB URI, NextAuth secret, etc.
npm install
npm run dev
```

### Mobile App

```bash
cd mobile
npm install
npx expo start
```

## Documentation

| File | Purpose |
|------|---------|
| [PROJECT_PROMPT_AND_SPECIFICATION.md](./PROJECT_PROMPT_AND_SPECIFICATION.md) | Full product spec |
| [SETUP_GUIDE.md](./SETUP_GUIDE.md) | Step-by-step setup (MongoDB, Cloudinary, Auth, Payments, FCM) |
| [web/README.md](./web/README.md) | Web app setup & features |
| [mobile/README.md](./mobile/README.md) | Mobile app setup |

## Features

- **Listings:** Sale/Rent, full fields, status (Draft/Active/Paused/Closed), Cloudinary images
- **Contact visibility:** Phone/email/agent only after login
- **WhatsApp CTA:** Pre-filled message with listing link
- **User levels & badges:** Guests, Verified Individual, Registered Agent, Registered Developer
- **Claim property:** Admin/AI listings claimable by verified users
- **Ratings:** After Sold/Rented, counterparty can rate the lister
- **Alerts:** Saved searches with push/email notifications
- **Boost listing:** Pay via Paystack/Flutterwave for "Sponsored" badge
- **Banner ads:** Admin-assigned slots
- **Payments:** Flutterwave + Paystack with webhooks and idempotency
- **SEO:** Meta tags, Open Graph, JSON-LD, sitemaps

## Environment Variables (Web)

See `web/.env.example` for the full list. Key vars:

- `MONGODB_URI` — MongoDB Atlas connection string
- `NEXTAUTH_URL` — App URL (e.g. http://localhost:3000)
- `NEXTAUTH_SECRET` — Generate with `openssl rand -hex 32`
- `CLOUDINARY_*` — Cloudinary credentials
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` — Optional Google login
- `PAYSTACK_*`, `FLUTTERWAVE_*` — Payment gateways

## Seed Admin User

```bash
cd web
ADMIN_EMAIL=admin@example.com ADMIN_PASSWORD=YourPassword123 npm run seed
```

## Deployment

- **Web:** See [HOSTING_AND_DOMAIN_SETUP.md](./HOSTING_AND_DOMAIN_SETUP.md) for deploying to Vercel and connecting digitproperties.com (Namecheap). Production env vars: `web/.env.production.example`
- **Mobile:** Build with EAS: `eas build --platform all`

### Vercel image optimization (usage monitoring)

Listing photos are served from **Cloudinary** and bypass Vercel’s image optimizer (`unoptimized` + sized Cloudinary URLs via `web/src/lib/next-image.ts`). Vercel optimization is only used for a small set of remote images (e.g. OAuth avatars).

**Monitor usage:** Vercel dashboard → **Usage** → **Image Optimization** (also **Observability** for detail). Free tier includes **5,000 transformations/month**; alerts at 75% and 100%.

**If usage spikes again:**

1. Confirm listing `<Image>` components use `listingImageProps()` from `@/lib/next-image`.
2. Check `web/next.config.js` — `minimumCacheTTL`, single `formats: ['image/webp']`, and trimmed `deviceSizes` / `imageSizes`.
3. Avoid routing Cloudinary URLs through `next/image` without `unoptimized` (double optimization).

Reference: [Managing image optimization costs](https://vercel.com/docs/image-optimization/managing-image-optimization-costs).
