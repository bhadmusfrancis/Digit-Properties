# Digit Properties — Comprehensive Project Prompt & Specification

**Use this prompt to deliver a Zillow-standard, production-ready cross-platform real estate platform for digitproperties.com (Nigeria).**

---

## 1. Project Overview

Build **Digit Properties** — a full-stack, cross-platform real estate platform (web + mobile) for the Nigerian market. The product must support **Buy**, **Sell**, and **Rent/Lease** of properties with professional UI/UX, enterprise-grade security, and monetization (ads, boosted listings, payments). Quality bar: **Zillow-level** professionalism and feature completeness.

**Target audience:** Nigeria (NG locale, NGN currency, Nigerian phone/address formats, local payment rails).

**Brand:** digitproperties.com — use this domain for SEO, sitemaps, and canonical URLs.

---

## 2. Technical Stack (Recommended)

- **Frontend (Web):** Next.js 14+ (App Router), TypeScript, Tailwind CSS, React Query/TanStack Query, next-seo, next-sitemap.
- **Mobile:** React Native (Expo) — for true cross-platform (iOS + Android) and shared business logic where possible.
- **Backend:** Node.js (Express/Fastify) or Next.js API Routes; TypeScript throughout.
- **Database:** **MongoDB Atlas** (primary). Use Mongoose with strict schemas, indexing, and aggregation for listings/search.
- **File/Media:** **Cloudinary** for images and documents (optimization, transformations, CDN). Store only Cloudinary `public_id` and derived URLs in DB.
- **Auth:** NextAuth.js or Auth.js (web) with credentials + **social logins** (Google, Facebook, Apple). JWT or session-based; ensure “login required” for contact details.
- **Payments:** **Flutterwave** and **Paystack** — both integrated; user or admin selects preferred gateway. Webhooks for verification, idempotency keys.
- **Search:** MongoDB Atlas Search or Elasticsearch/Meilisearch for full-text and filters (location, price, type, tags).
- **Notifications:** Firebase Cloud Messaging (FCM) or other alternative for push; in-app + email for alerts (e.g. “new listing matching your alert”).
- **Ads:** Server-rendered slots for **banner ads** and **Google AdSense**; custom “boost listing” system storing boost tier and expiry in DB.
- **Security:** See Section 5 (security-first coding).

*If you recommend alternatives (e.g. different DB or auth), document the rationale and keep MongoDB Atlas + Cloudinary as the default unless explicitly overridden.*

---

## 3. Core Features (Must-Have)

### 3.1 Listings

- **Types:** Sale, Rent/Lease (with lease duration options).
- **Fields:** Title, description, location (address, city, state, coordinates), price (NGN), property type (e.g. apartment, house, land, commercial), bedrooms, bathrooms, area (sqm), amenities, multiple images (Cloudinary), documents (optional), listing tags (e.g. “luxury”, “new”, “verified”).
- **Status:** Draft, Active, Paused, Closed.
- **Ownership:** Listings can be created by: **Admin**, **AI/Agent** (system), **Verified Individual**, **Registered Agent**, **Registered Developer**. Support **“Claim property”** for listings that were created by Admin or AI: allow verified users/agents/developers to submit a claim with proof; admin approves/rejects; on approval, listing ownership transfers and badge reflects new owner type.

### 3.2 User Levels & Badges

- **Guests:** Can browse listings; **cannot** view contact details (phone/email/agent). Must sign up/login to unlock.
- **Verified Individual:** Registered, identity-verified (process to be defined — e.g. document upload + admin verification). Badge: “Verified Individual” on profile and listings.
- **Registered Agent:** Verified agent (e.g. license/registration). Badge: “Registered Agent” on profile and listings.
- **Registered Developer:** Verified developer/company. Badge: “Registered Developer” on profile and listings.

Display badges clearly on listing cards, listing detail, and author/profile pages. Enforce permissions by level (e.g. only agents/developers can create “Agent/Developer” listings if you distinguish them).

### 3.3 Contact Visibility & WhatsApp

- **Contact details** (phone, email, agent name) are **only visible after login** (any logged-in user level).
- **“Send WhatsApp message”** button: pre-fill message with listing title and link; open WhatsApp (web or app) with recipient number (use Nigerian format). Ensure number is only exposed after login.

### 3.4 Ratings & Feedback

- **User ratings and feedback** based on **completed** transactions (sold/rented). Options:
  - Mark listing as “Sold”/“Rented” (by lister or admin), then enable rating of the lister/agent by the counterparty.
  - Or: rating only for “Registered Agent”/“Registered Developer” profiles based on past deals.
- Store: rating (1–5), optional text review, reviewer ID, listing ID, date. Display aggregate rating and recent reviews on profile/listings. Moderate reviews (flag/hide) from admin.

### 3.5 Claim Property

- For listings created by **Admin** or **AI/Agent** (system):
  - Allow **Verified Individual**, **Registered Agent**, or **Registered Developer** to **claim** the property.
  - Flow: user requests claim → uploads proof (e.g. ownership/authorization) → admin reviews → approve/reject. On approval: assign listing to claimant, update badge, optional notification.
- Show “Claim this property” CTA on listing page when listing is claimable and user is logged in with eligible level.

### 3.6 Alerts & Push Notifications

- **Listing tags** (e.g. “3-bedroom”, “Lagos”, “under 50M”) plus filters (location, price range, type).
- **User-created alerts:** Save search (filters + optional tags). When **new listings** match the saved search, trigger:
  - **Push notification** (FCM) and/or
  - **Email** (e.g. digest or instant).
- Ensure “new” is defined (e.g. listed in last 24–48 hours) and avoid duplicate notifications for the same listing per user.

### 3.7 SEO (100% Optimized)

- **Next.js:** Semantic HTML, meta title/description per page, Open Graph, Twitter Cards, canonical URLs (digitproperties.com).
- **Structured data:** JSON-LD for `RealEstateAgent`, `Product`/Listing (price, location, availability).
- **Sitemaps:** Auto-generated (next-sitemap or custom) for listing URLs, static pages; submit to Google Search Console.
- **Performance:** Image optimization (Cloudinary + Next.js Image), lazy loading, core web vitals. Server-side render listing and category pages where beneficial for SEO.
- **Nigeria focus:** Local business schema where relevant; hreflang if you add other locales later.

### 3.8 Dashboards

- **User dashboard:** Profile, My Properties (draft/active/closed), saved searches/alerts, saved listings, my claims (status), payment history (boosts, ads), ratings received, settings (notification prefs, social account linking).
- **Admin dashboard:** Users (list, verify, suspend), listings (moderate, feature, close), claims (approve/reject), ads (banner slots, boost requests), payments (Flutterwave/Paystack logs), ratings moderation, reports, basic analytics (views, top listings). Role-based access (admin only).

### 3.9 Monetization & Ads

- **Boost listing:** Users pay (Paystack/Flutterwave) to “boost” a listing (e.g. higher in search, “Sponsored” badge). Store boost tier, start/end date; run cron or serverless to demote when expired.
- **Banner ads:** Reserved slots (e.g. homepage, sidebar, listing detail). Admin can assign internal campaigns or external (e.g. image + link). Store in DB; render server-side.
- **Google AdSense:** Integrate AdSense script and ad units in designated placeholders (policy-compliant placement). Do not place in flows that require login (e.g. inside dashboard) if against AdSense TOS.

### 3.10 Payments

- **Flutterwave** and **Paystack:** Both supported. Use official SDKs; server-side initiation and webhook verification. Use **idempotency keys** for duplicate prevention. Store transaction ID, amount, currency (NGN), status, user ID, purpose (boost, ad, subscription if any). Never store full card details.

---

## 4. UI/UX Requirements

- **Professional, Zillow-standard design:** Clean, trustworthy, easy navigation. Consistent design system (colors, typography, spacing) across **web** and **mobile**.
- **Responsive:** Mobile-first; breakpoints for tablet and desktop. Touch-friendly on mobile.
- **Accessibility:** ARIA where needed, keyboard navigation, sufficient contrast (WCAG 2.1 AA target).
- **Assets:** Generate or procure:
  - **Logo** for Digit Properties (use design tools or AI image generation; provide SVG + PNG, light/dark variants).
  - **Favicon**, OG default image, app icons (mobile).
  - **Placeholder/empty states** for no listings, no search results, no alerts.
- **Copy:** Use Nigeria-appropriate language and NGN formatting. “Rent/Lease” clearly labeled; states/cities consistent (e.g. Lagos, Abuja, Port Harcourt).

---

## 5. Security (Latest Cyber-Security Proof Coding)

- **Authentication:** Secure session/JWT storage (httpOnly cookies preferred for web). Hash passwords with **bcrypt** or **argon2**. Social logins via OAuth 2.0; validate state and tokens.
- **Authorization:** Role-based access (Guest, Verified Individual, Registered Agent, Registered Developer, Admin). Enforce on every API and page that exposes contact data or sensitive actions.
- **Input validation:** Validate and sanitize all inputs (use **Zod** or similar) on backend. Never trust client. Protect against NoSQL injection (parameterized queries, Mongoose schema validation).
- **API:** Rate limiting (per IP and per user). CORS restricted to your domains. No sensitive data in URLs (use POST body or headers for tokens).
- **Secrets:** Environment variables for DB, Cloudinary, payment keys, JWT secret. Never commit secrets. Use different keys for dev/staging/production.
- **Headers:** Security headers (CSP, X-Frame-Options, HSTS, etc.) via middleware or server config.
- **File upload:** Only allow image/document types; validate magic bytes; upload to Cloudinary from backend or signed upload with size/type limits.
- **Payments:** Verify webhooks with signing secret; idempotency; log all payment events for audit.

---

## 6. Step-by-Step Setup (High Level)

1. **Repo & environment**
   - Initialize monorepo or separate repos for web, mobile, API (as chosen).
   - Create `.env.example` with all required vars (MongoDB URI, Cloudinary, Flutterwave, Paystack, NextAuth secret, FCM, etc.). Document each in README.

2. **MongoDB Atlas**
   - Create cluster; create DB user with least privilege.
   - Whitelist IPs or use VPC peering if needed; enable TLS.
   - Create collections: users, listings, claims, reviews, alerts, payments, boosts, banners, etc. Add indexes (e.g. listing: status, location, price, createdAt; user: email).

3. **Cloudinary**
   - Create cloud; get cloud name, API key, API secret.
   - Set upload presets (e.g. listing images: max size, format). Use folder structure (e.g. `listings/{listingId}`). Configure allowed formats and max file size.

4. **Auth (NextAuth/Auth.js)**
   - Configure Credentials and Google/Facebook/Apple providers. Map social profile to user (email, name, image). Create user in DB on first login. Implement “login required” middleware for routes that show contact details.

5. **Payments**
   - Create Flutterwave and Paystack accounts; get API keys (live and test). Implement “create transaction” and “verify transaction” endpoints; webhook handlers that verify signature and update payment status. Implement boost purchase flow that sets listing boost end date.

6. **Push & alerts**
   - Set up FCM project; store FCM tokens per user (mobile and optional web). On new listing that matches a saved alert, enqueue job to send push + email.

7. **Admin**
   - Seed first admin user (or invite flow). Protect admin routes by role. Build admin UI for users, listings, claims, ads, payments.

8. **SEO & go-live**
   - Generate sitemap; set up GSC. Add AdSense if approved. Run security and performance checks. Deploy (e.g. Vercel for Next.js; app stores for mobile).

---

## 7. Deliverables Checklist

- [ ] Responsive website (digitproperties.com) with listings, search, filters, tags, alerts, user and admin dashboards.
- [ ] Cross-platform mobile app (iOS + Android) with feature parity where applicable.
- [ ] MongoDB Atlas schemas and indexes; Cloudinary integration for all media.
- [ ] Auth with login-required contact visibility and social logins.
- [ ] User levels (Guests, Verified Individual, Registered Agent, Registered Developer) with badges on listings and profiles.
- [ ] Claim property flow for Admin/AI-created listings.
- [ ] Ratings/feedback for completed sales/rentals.
- [ ] WhatsApp send message; contact details only after login.
- [ ] 100% SEO optimized (meta, JSON-LD, sitemaps, performance).
- [ ] Boost listing + banner ads + AdSense integration.
- [ ] Flutterwave and Paystack integrated with webhooks and idempotency.
- [ ] Listing tags and user alerts with push and email notifications.
- [ ] Professional UI/UX and assets (logo, favicon, app icons).
- [ ] Security best practices applied throughout.
- [ ] README with step-by-step setup (env, Atlas, Cloudinary, auth, payments, FCM).

---

## 8. Optional Extensions (ETC)

- **Chat:** In-app messaging between interested users and listers.
- **Virtual tours:** Embed or link to 360° tours.
- **Document verification:** Automated checks (e.g. document type) for verification.
- **Multi-language:** e.g. English + Pidgin or French for future expansion.
- **Analytics:** Dashboard charts (views, conversions, revenue) and optional Google Analytics 4.

---

*Use this document as the single source of truth when prompting an AI or development team to build Digit Properties. Adjust stack or features only with explicit approval and document changes.*
