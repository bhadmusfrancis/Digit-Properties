# Input Validation (Web & Mobile)

All API routes validate input server-side to enhance security. Clients (web and mobile) should still validate/sanitize input for better UX and to avoid unnecessary requests.

## Server-side (Web API)

- **Zod** schemas in `web/src/lib/validations.ts` define allowed shape, types, and bounds (length, range).
- Routes use `schema.safeParse(body)` or `schema.safeParse(params)` and return **400** with `{ error: string }` (or flattened errors) when validation fails.
- **IDs**: MongoDB ObjectIds are validated with `objectIdSchema` (24 hex chars). Invalid IDs return 400.
- **Query params**: Listing search and similar GET endpoints cap `page`, `limit`, and string lengths to prevent abuse.
- **Body**: Max lengths and strict types (e.g. email, URL, enum) are enforced. Unknown keys are rejected where `.strict()` is used.

## Key validated endpoints

| Area | Endpoints | Schema / checks |
|------|-----------|-----------------|
| Auth | register, login, forgot-password, resend-verification, reset-password, mobile-signin | registerSchema, loginSchema, forgotPasswordSchema, resendVerificationSchema, resetPasswordSchema |
| Contact | POST /api/contact | contactFormSchema (email, name, subject, message lengths) |
| Verification | POST /api/verification/request | verificationRequestSchema (type, documentUrls, companyPosition) |
| Me | PATCH /api/me, POST verify-phone, confirm-phone, liveness | meUpdateSchema, phoneVerifySchema, confirmPhoneSchema, livenessSchema |
| Listings | POST /api/listings, GET query params | listingSchema, listingQuerySchema (page, limit, string caps) |
| Saved | POST /api/saved | savedListingSchema (listingId ObjectId) |
| Claims | POST /api/claims, GET listingId param | claimSchema, objectIdSchema |
| Reviews | POST /api/reviews, GET revieweeId/listingId | reviewSchema, objectIdSchema |
| Alerts | POST /api/alerts | alertSchema |

## Mobile

- The API is the source of truth: invalid or oversized input will receive **400** and `{ error: "..." }`.
- In `mobile/lib/api.ts`, handle 400 responses and show `error` to the user.
- Where possible, validate in the app before calling the API (e.g. non-empty email, ID format) to avoid round-trips.
