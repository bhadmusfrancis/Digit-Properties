# Copy-Paste AI Implementation Prompt

**Use this block verbatim (or with minor edits) when briefing an AI or team to build Digit Properties.**

---

You are building **Digit Properties** (digitproperties.com), a Zillow-standard, production-ready cross-platform real estate platform for **Nigeria**. Deliver a responsive **website** and **mobile app** (React Native/Expo or Flutter) where users can **Buy**, **Sell**, and **Rent/Lease** properties.

## Stack
- **Web:** Next.js 14+ (App Router), TypeScript, Tailwind CSS. **Backend:** Node/Next.js API. **DB:** MongoDB Atlas. **Media:** Cloudinary. **Auth:** NextAuth/Auth.js with credentials + Google, Facebook, Apple. **Payments:** Flutterwave and Paystack (both; webhooks, idempotency). **Push:** FCM. **SEO:** next-seo, JSON-LD, sitemaps.

## Must-have features
1. **Listings:** Sale/Rent; full fields (title, description, location, price NGN, type, beds, baths, area, amenities, images via Cloudinary, tags). Status: Draft/Active/Paused/Closed.
2. **Contact visibility:** Show listing contact details (phone, email, agent) **only after login**. Include **“Send WhatsApp message”** button (pre-filled message + listing link).
3. **User levels & badges:** Guests (browse only) | Verified Individual | Registered Agent | Registered Developer. Show badges on listing cards, detail page, and author/profile.
4. **Claim property:** Listings created by Admin or AI can be **claimed** by verified users/agents/developers (submit proof → admin approves → ownership and badge update).
5. **Ratings & feedback:** After a listing is marked Sold/Rented, allow counterparty to rate and review the lister; show aggregate rating and reviews on profiles/listings.
6. **Alerts & push:** Users create saved searches (filters + tags). When **new listings** match, send **push notification** (FCM) and/or **email**.
7. **SEO:** 100% optimized — meta tags, Open Graph, JSON-LD (RealEstateAgent, listing schema), sitemaps, Core Web Vitals, Nigeria-focused.
8. **Dashboards:** **User:** profile, My Properties, saved searches/alerts, claims, payments, ratings. **Admin:** users, listings, claims, ads, payments, moderation.
9. **Monetization:** (a) **Boost listing** — pay via Paystack/Flutterwave; listing gets “Sponsored” and higher rank until expiry. (b) **Banner ads** — admin-assigned slots. (c) **Google AdSense** in policy-compliant slots.
10. **Security:** Input validation (Zod), parameterized DB, bcrypt/argon2, httpOnly cookies, rate limiting, CORS, security headers, no secrets in repo. Enforce role checks on every sensitive API and page.

## UI/UX
- Professional, Zillow-level design; consistent design system across web and mobile. Mobile-first, responsive, accessible (WCAG 2.1 AA). Generate or provide **logo** (SVG/PNG), favicon, app icons, and empty-state assets.

## Setup
- Provide **step-by-step setup**: env vars (MongoDB Atlas URI, Cloudinary, Flutterwave, Paystack, NextAuth, FCM), Atlas indexes, Cloudinary folders/presets, first admin user, webhook URLs for payments. Document in README.

## Deliverables
- Working web app + mobile app, MongoDB + Cloudinary integrated, auth + social login, all user levels and badges, claim flow, ratings, WhatsApp CTA, alerts/push, SEO, boost + banners + AdSense, Flutterwave + Paystack, secure and production-ready.

Reference the full specification in **PROJECT_PROMPT_AND_SPECIFICATION.md** for detailed requirements, schema ideas, and optional extensions.
