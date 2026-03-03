# User Verification Process — Expert Guide (All User Categories)

This document defines how to implement and operate **user verification** for every user category on Digit Properties: **ID card**, **phone (WhatsApp)**, **liveness (face)** for all; **position in company** and **professional documents** for Registered Agent/Developer; and how submitted documents are verified.

---

## 1. Current State (Summary)

| Aspect | Current implementation |
|--------|-------------------------|
| **User roles** | `guest`, `verified_individual`, `registered_agent`, `registered_developer`, `admin` |
| **Email verification** | Credentials signup: token link (24h), blocks sign-in until verified. OAuth: `verifiedAt` set on first login. |
| **Role assignment** | Admin only, via PATCH `/api/admin/users/[id]` — no self-service or application flow. |
| **Claim property** | Only `verified_individual`, `registered_agent`, `registered_developer` can submit claims; admin approves. |
| **Listing creation** | All of: admin, guest, verified_individual, registered_agent, registered_developer (no extra verification gate). |

**Gap:** No formal **ID**, **phone (WhatsApp)**, **liveness**, or **professional** verification with document review and audit trail. This doc defines the full flow including **how to verify submitted documents**.

---

## 2. Verification Types (Taxonomy)

**All user categories** (except Admin) must complete:

| Layer | Purpose | Method |
|-------|--------|--------|
| **1. Email** | Confirm control of email | Token link (already implemented); OAuth = trusted |
| **2. Phone** | Confirm control of phone; reduce fake accounts | **WhatsApp** OTP (link or code sent via WhatsApp) |
| **3. ID document** | Confirm real identity | Upload **ID card** (e.g. NIN slip, voter card, passport) — required for every role |
| **4. Liveness** | Prove the person is live (not a photo/video replay) | Device camera: user performs **facial movements** (e.g. blink, turn head, smile); capture becomes **profile picture** until user becomes Registered Agent or Developer |

**Additional for Registered Agent / Registered Developer only:**

| Layer | Purpose | Method |
|-------|--------|--------|
| **5. Position in company** | Role at agency/developer | Free-text or dropdown: e.g. "Agent", "Senior Agent", "Director", "CEO", "Marketing Manager" — stored on User and shown on profile/listings |
| **6. Professional documents** | Legitimacy (license/company) | Upload license (Agent) or CAC/company proof (Developer); verified per [Section 3.7](#37-how-to-verify-submitted-documents) |

**Profile picture rule:**

- **Liveness capture** is the **only** profile picture until the user is upgraded to **Registered Agent** or **Registered Developer**. After that, they may change their profile picture (e.g. professional headshot or logo).
- Stored as `image` (or `livenessImageUrl`); flag `profilePictureLocked: true` until role is `registered_agent` or `registered_developer`.

**Per role:**

- **Guest:** Must complete Email + Phone (WhatsApp) + ID + Liveness before they can use contact visibility / claim / full features. Liveness photo = profile picture (locked).
- **Verified Individual:** Same (Email, Phone, ID, Liveness); identity doc approved by admin. Profile picture remains liveness until they upgrade to Agent/Developer.
- **Registered Agent:** All of the above + **position in company** + **professional doc** (license/registration). Admin verifies docs. After approval, user can **change profile picture**.
- **Registered Developer:** All of the above + **position in company** + **professional doc** (CAC/company). Admin verifies docs. After approval, user can **change profile picture**.
- **Admin:** No verification flow; created by seed/super-admin; 2FA and audit logs.

---

## 3. User Categories and Verification Flows

### 3.1 Common steps for all users (Guest, Verified Individual, Agent, Developer)

Every user must complete these **in order** (or in a single onboarding flow):

1. **Email**
   - Credentials: token link (existing). OAuth: `verifiedAt` on first login.
2. **Phone (WhatsApp)**
   - User enters phone (e.g. Nigerian format). System sends **WhatsApp** message with OTP or verification link.
   - User submits code or clicks link → backend sets `phoneVerifiedAt`. Store `phone` on User.
   - Implementation: WhatsApp Business API, or a provider that supports WhatsApp (e.g. Twilio, MessageBird, Termii). Alternative: send link via WhatsApp that hits `GET /api/auth/verify-phone?token=...`.
3. **ID document**
   - User uploads **one** government-issued ID (NIN slip, voter card, international passport). Front + back if applicable.
   - Stored in verification request or a dedicated “identity” verification record; admin (or automated checks) verify per [Section 3.7](#37-how-to-verify-submitted-documents).
   - On approval: set `idVerifiedAt` (or keep single `identityVerifiedAt` for “identity doc approved”).
4. **Liveness**
   - User opens **device camera** in-app (web or mobile). Guided steps:
     - Frame face in oval (on-screen guide).
     - Perform movements: e.g. **blink**, **turn head left/right**, **smile** (sequence chosen randomly to resist replay).
   - Backend receives short video or a few frames; runs **liveness check** (see [Section 3.6](#36-liveness-verification)) to ensure live person, not photo/video.
   - On success: extract or accept **one frame** as profile picture. Store URL in `image` (or `livenessImageUrl`). Set `livenessVerifiedAt`. Set **profilePictureLocked = true** (user cannot change photo until they become Registered Agent or Developer).

**Enforcement:** Until Email + Phone + ID + Liveness are done, restrict: contact visibility, claiming listings, creating listings (or limit to draft only), depending on product choice. Show clear “Complete verification” CTA in dashboard.

---

### 3.2 Guest

**Who:** Anybody who signs up; not yet upgraded to Verified Individual / Agent / Developer.

**Verification:** Must complete **Email → Phone (WhatsApp) → ID upload → Liveness**. Profile picture = liveness capture only; **locked** (no custom upload).

**Role upgrade:** Guest applies for **Verified Individual**, **Registered Agent**, or **Registered Developer** (each has its own request + doc requirements). Until then, they remain `guest` with full base verification.

---

### 3.3 Verified Individual

**Who:** A real person (buyer/seller/renter) with identity and liveness verified.

**Verification:** Same as Guest (Email, Phone, ID, Liveness). The **ID document** is reviewed by admin (or automated pipeline); on approve, set `role = verified_individual` and `identityVerifiedAt`. Profile picture remains **liveness** (locked) until they later upgrade to Agent/Developer.

**Flow:** Complete base verification → Apply “Verify as Individual” (if not auto-approved after ID review) → Admin approves → Badge “Verified Individual”.

---

### 3.4 Registered Agent

**Who:** Real estate agent (individual or agency rep) with verified license/registration.

**Verification:**

- All base steps (Email, Phone, ID, Liveness).
- **Position in company:** Required. User selects or types role, e.g. “Agent”, “Senior Agent”, “Team Lead”, “Director”, “CEO”. Stored in `companyPosition` (or `positionInCompany`). Shown on profile and listing cards.
- **Professional document:** Upload RECON certificate, agency ID, or letter from recognized agency. Admin (and/or automated checks) verify per [Section 3.7](#37-how-to-verify-submitted-documents). On approve: set `role = registered_agent`, `professionalVerifiedAt`.

**Profile picture:** After approval, **unlock** profile picture — user may upload a professional photo (or keep liveness).

---

### 3.5 Registered Developer

**Who:** Property developer or company rep with verified business.

**Verification:**

- All base steps (Email, Phone, ID, Liveness).
- **Position in company:** Required. E.g. “Project Manager”, “Director”, “CEO”, “Marketing”. Stored in `companyPosition`. Shown on profile and listings.
- **Professional document:** Upload CAC certificate, project permit, or official company letter. Verified per [Section 3.7](#37-how-to-verify-submitted-documents). On approve: set `role = registered_developer`, `professionalVerifiedAt`.

**Profile picture:** After approval, **unlock** — user may change to company logo or professional photo.

---

### 3.6 Liveness verification

**Goal:** Ensure the person in front of the camera is **live** (not a printed photo, screen, or pre-recorded video).

**Flow:**

1. **Capture:** Use device camera (getUserMedia on web; expo-camera or similar on mobile). Show an on-screen guide (face oval).
2. **Challenge:** Ask user to perform **2–3** actions in sequence, e.g.:
   - Blink once
   - Turn head slowly left then right
   - Smile
   - (Randomise order to reduce replay attacks.)
3. **Submit:** Send to backend either:
   - **Option A:** Short video (e.g. 3–5 s) + server-side liveness (see below), then server extracts one frame for profile picture; or
   - **Option B:** Client-side SDK captures frames and sends only the “best” face frame + a liveness score/token from an embedded SDK.
4. **Profile picture:** Store the approved face image URL in `User.image`. Set `User.profilePictureLocked = true` and `User.livenessVerifiedAt = new Date()`. This image is the **only** allowed profile picture until role is `registered_agent` or `registered_developer`; then allow profile update (new `image` and set `profilePictureLocked = false`).

**How to implement liveness:**

- **Third-party APIs:** Use a provider that returns “live” vs “spoof” (e.g. FaceTec, iProov, Onfido, Veriff). They often return a verified face image or token; you store that image as profile picture.
- **Lightweight / in-house:** Simpler approach: analyse frames for blink/motion (e.g. OpenCV or a small model). Less robust against sophisticated spoofs but cheaper. Best to combine with random challenges and rate limits (e.g. max 3 attempts per day).
- **Mobile:** Same flow; use native camera and send video or frames to your backend or to the third-party API.

**Security:** Rate-limit attempts; log failures; consider blocking after repeated failures (e.g. 5) and require support to unlock.

---

### 3.7 How to verify submitted documents

Submitted documents are **ID cards**, **professional licenses**, and **company documents**. Verification can be **manual**, **automated**, or **hybrid**.

#### A. Manual (admin review)

- Admin opens “Verification requests” (or “Documents”) in admin panel.
- For each request: view uploaded files (images/PDFs) in a secure viewer (signed URLs, no public access).
- **ID document:** Check that the document type is accepted (NIN, voter card, passport), is readable, not expired, and that name/photo align with the account (and optionally with liveness photo).
- **Professional (Agent):** Check RECON/agency doc is genuine, name matches, optional cross-check with RECON registry or agency website.
- **Professional (Developer):** Check CAC or company letter; optional search on CAC portal or company website.
- Admin clicks **Approve** or **Reject** (with reason). Approve → set role and *VerifiedAt; Reject → notify user, allow re-apply after cooldown.

**Best for:** Small/medium volume; high accuracy when admins are trained; no extra integration cost.

#### B. Automated checks (rules + optional OCR)

- **Format/type:** Reject if file type not allowed (e.g. only image/PDF), size limits, basic virus scan.
- **OCR (optional):** Extract text from ID (name, number, expiry). Validate expiry date; store “document number” (hashed) to detect duplicate IDs. Compare extracted name to `User.name` (fuzzy match).
- **Tampering:** Use an API or library that checks for signs of editing (e.g. inconsistent fonts, cloning). Optional.
- **Output:** “Auto-approved” if rules pass (and optionally human review for edge cases), or “Flag for review” if mismatch or low confidence.

#### C. Third-party KYC / document verification

- Integrate a provider (e.g. Smile Identity, YouVerify, Dojah, Onfido, Jumio) that:
  - Accepts document upload + selfie/liveness.
  - Returns: document type, extracted data, liveness result, “verified” or “rejected”.
- You send document URL + user id; provider returns result; you set `idVerifiedAt` or create a verification request and mark approved/rejected. Optionally use their face match (document photo vs liveness) to strengthen identity binding.
- **Cost:** Per verification; suitable for scale and compliance.

#### Recommended approach (hybrid)

1. **All documents:** Manual admin review at least for first batch; add automated rules (format, expiry, duplicate ID check) to reduce load.
2. **Scale or compliance:** Add a Nigerian-focused KYC provider (e.g. Smile Identity, YouVerify, Dojah) for ID + optional face match; keep admin override for edge cases.
3. **Professional docs:** Prefer manual review (RECON/CAC are less standardised for full automation); optional OCR to pre-fill “license number” or “company name” for admin to cross-check on external portals.

**Audit:** Log every document view, approval, and rejection (who, when, request id, reason) for compliance and disputes.

---

### 3.8 Admin

**Who:** Platform staff.

**Process:** Created via seed or by another admin. No ID/phone/liveness/document flow. Protect with 2FA and audit logs. No profile-picture lock (admins can set their own).

---

## 4. Data Model Extensions

### 4.1 User model (additions)

Add to `IUser` / `User` schema:

```ts
// Add to IUser (User.ts)
phoneVerifiedAt?: Date;           // set when WhatsApp (or phone) OTP/link confirmed
identityVerifiedAt?: Date;         // set when ID document approved (all roles)
professionalVerifiedAt?: Date;    // set when agent or developer professional doc approved
livenessVerifiedAt?: Date;        // set when liveness challenge passed
image?: string;                   // existing: profile picture; from liveness until Agent/Developer
profilePictureLocked?: boolean;   // true until role is registered_agent or registered_developer
companyPosition?: string;          // position in company (Agent/Developer only), e.g. "Agent", "Director"
```

- **profilePictureLocked:** When `true`, user cannot change `image`; only liveness capture is allowed. Set `false` when role becomes `registered_agent` or `registered_developer` (or on approve of that verification request).
- **companyPosition:** Required when applying for Agent/Developer; shown on profile and listing cards.

### 4.2 Verification request (new collection)

One collection for **identity/professional** verification requests (ID doc and, for Agent/Developer, professional doc + position):

```ts
// VerificationRequest.ts
interface IVerificationRequest {
  _id: ObjectId;
  userId: ObjectId;
  type: 'verified_individual' | 'registered_agent' | 'registered_developer';
  status: 'pending' | 'approved' | 'rejected';
  documentUrls: string[];         // ID + optional professional docs (Cloudinary signed URLs)
  companyPosition?: string;      // required for agent/developer
  message?: string;
  reviewedBy?: ObjectId;
  reviewedAt?: Date;
  rejectionReason?: string;
  documentVerificationMethod?: 'manual' | 'automated' | 'third_party'; // audit
  createdAt: Date;
  updatedAt: Date;
}
```

- One **pending** request per user per `type`. On approve: set `User.role`, `identityVerifiedAt` / `professionalVerifiedAt`, and for Agent/Developer set `User.companyPosition` and `profilePictureLocked = false`.
- Indexes: `{ userId: 1, type: 1 }`, `{ status: 1 }`.

### 4.3 Phone (WhatsApp) verification

- Store on User: `phone`, `phoneVerifiedAt`. Optionally `phoneVerificationToken` + `phoneVerificationExpires` for WhatsApp link; or use short-lived cache (Redis) keyed by `phone` or `userId` for OTP code.
- Send WhatsApp via provider (Twilio, MessageBird, Termii, etc.); user clicks link or submits code → set `phoneVerifiedAt`.

---

## 5. API Design (High Level)

- **Email:** (existing) `POST /api/auth/register`, `GET /api/auth/verify-email?token=`, `POST /api/auth/resend-verification`.
- **Phone (WhatsApp):**
  - `POST /api/me/verify-phone` — body `{ phone }` → send WhatsApp OTP or link, rate-limit.
  - `POST /api/me/confirm-phone` — body `{ code }` or `GET /api/auth/verify-phone?token=...` → set `phoneVerifiedAt`.
- **Liveness:**
  - `POST /api/me/liveness` — body: video blob or frames + challenge response (or multipart). Server runs liveness check; on success saves profile image to Cloudinary, sets `User.image`, `livenessVerifiedAt`, `profilePictureLocked = true`. Returns success or failure.
- **Profile picture:**
  - `PATCH /api/me` or `PUT /api/me/profile` — allow updating `image` only if `!profilePictureLocked` (i.e. user is Registered Agent or Developer). Otherwise return 403 with message that profile picture is set from liveness until they upgrade.
- **Verification requests (role upgrade):**
  - `POST /api/verification/request` — body `{ type, documentUrls[], companyPosition?, message? }` (companyPosition required for agent/developer). Create request; enforce one pending per type; require base verification (email, phone, ID, liveness) done.
  - `GET /api/verification/request` — list current user’s requests and status.
  - Admin:
    - `GET /api/admin/verification-requests` — list pending (and recent) with user info, docs, position.
    - `POST /api/admin/verification-requests/[id]/approve` — set role, *VerifiedAt, companyPosition; for Agent/Developer set `profilePictureLocked = false`.
    - `POST /api/admin/verification-requests/[id]/reject` — body `{ reason }`, mark rejected, notify user.

Use existing session and admin checks throughout.

---

## 6. UI/UX (Concise)

- **Onboarding / Dashboard (user):**
  - Stepper or checklist: 1) Email → 2) Phone (WhatsApp) → 3) ID upload → 4) Liveness. Block or limit features until complete.
  - **Phone:** Enter phone → “Send code via WhatsApp” → enter code or click link.
  - **ID:** Upload ID (front/back); submit; “Under review”.
  - **Liveness:** “Start verification” → open camera → follow prompts (blink, turn head, smile) → submit. Success → “Your profile picture has been set; you can change it after becoming a Registered Agent or Developer.”
  - Then: “Verify as Individual” / “Register as Agent” / “Register as Developer”. For Agent/Developer: **Position in company** (dropdown or text) + professional doc upload. Show status: Pending / Approved / Rejected (with reason).
- **Profile:**
  - Phone + “Verify via WhatsApp” if not verified. Badge (Verified Individual / Registered Agent / Registered Developer). **Position in company** for Agent/Developer.
  - If `profilePictureLocked`: show liveness photo, message “Profile picture can be changed after you become a Registered Agent or Developer.” If not locked: allow “Change photo”.
- **Admin:**
  - “Verification requests”: table with user, type, **position** (for Agent/Developer), document links (secure viewer), Approve / Reject (reason). Optional: “Document verification method” (manual/automated/third_party) for audit.
  - User detail: verification history, liveness/ID/professional status.

---

## 7. Security and Compliance

- **Documents:** Store in private or signed Cloudinary (or equivalent); admin view via authenticated, role-checked API only; never expose raw docs publicly.
- **Liveness data:** Store only the **approved profile image**; do not retain full video longer than needed for one-time liveness check (or per provider policy).
- **PII:** Phone, ID, face image are sensitive; encrypt at rest if required; restrict to admin and the user.
- **Audit:** Log verification request create/approve/reject (who, when, id, reason), role changes, document verification method (manual/automated/third_party).
- **Rate limiting:** WhatsApp OTP, liveness attempts (e.g. 3/day), verification request creation (e.g. 1 per type per 30 days after reject).
- **Consent:** Before ID/liveness upload, show “We use this only for verification and compliance” and require explicit consent.

---

## 8. Implementation Order (Phases)

1. **Phase 1 — Data model:**  
   Add to User: `phoneVerifiedAt`, `identityVerifiedAt`, `professionalVerifiedAt`, `livenessVerifiedAt`, `profilePictureLocked`, `companyPosition`. Add `VerificationRequest` model with `companyPosition`, `documentVerificationMethod`.

2. **Phase 2 — Phone (WhatsApp):**  
   Integrate WhatsApp provider; `POST /api/me/verify-phone`, confirm endpoint; set `phoneVerifiedAt`. Enforce in onboarding.

3. **Phase 3 — ID upload + admin review:**  
   User uploads ID in onboarding or verification request; admin reviews; set `identityVerifiedAt`. Document verification method: start with manual; add [Section 3.7](#37-how-to-verify-submitted-documents) options as needed.

4. **Phase 4 — Liveness:**  
   Camera flow (web + mobile); challenge (blink, head turn, smile); call liveness API or in-house check; on success set `image`, `livenessVerifiedAt`, `profilePictureLocked = true`. Enforce profile-picture lock in profile API until Agent/Developer.

5. **Phase 5 — Verified Individual / Agent / Developer requests:**  
   Verification request with `type`, `documentUrls`, `companyPosition` (for Agent/Developer). Admin approve/reject; set role, *VerifiedAt, companyPosition; for Agent/Developer set `profilePictureLocked = false`.

6. **Phase 6 — Document verification:**  
   Introduce automated checks (format, expiry, duplicate ID) and/or third-party KYC for ID; keep admin review for professional docs and overrides. Log `documentVerificationMethod`.

7. **Phase 7 — Hardening:**  
   Audit logs, rate limits, document retention policy, 2FA for admin.

---

## 9. Summary Table (All Categories)

| User category        | Email | Phone (WhatsApp) | ID document | Liveness (profile pic) | Position in company | Professional doc | Profile pic unlock |
|----------------------|-------|------------------|-------------|-------------------------|----------------------|------------------|--------------------|
| Guest                | Yes   | Yes              | Yes         | Yes                     | No                   | No               | No (locked)        |
| Verified Individual  | Yes   | Yes              | Yes         | Yes                     | No                   | No               | No (locked)        |
| Registered Agent     | Yes   | Yes              | Yes         | Yes                     | **Yes**              | Yes (license)    | **Yes**            |
| Registered Developer | Yes   | Yes              | Yes         | Yes                     | **Yes**              | Yes (company)    | **Yes**            |
| Admin                | Yes   | —                | —           | —                       | —                    | —                | Yes                |

- **Document verification:** Manual admin review, plus optional automated rules and/or third-party KYC; see [Section 3.7](#37-how-to-verify-submitted-documents).
- **Liveness:** Camera + facial movements; capture becomes profile picture until user becomes Registered Agent or Developer, then they can change it.

---

This gives a single verification story for all categories: **ID + WhatsApp + liveness** for everyone (liveness photo = profile picture until Agent/Developer); **position in company** and **professional documents** for Agent/Developer; **document verification** via manual review, automated checks, and/or third-party KYC as in Section 3.7.
