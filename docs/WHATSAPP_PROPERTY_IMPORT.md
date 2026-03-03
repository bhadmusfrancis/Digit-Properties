# Getting Property from WhatsApp (Groups / Status) into Digit Properties

This document describes how **agents** (or staff) can get property information from **WhatsApp group messages** or **WhatsApp status**, format it, and load it into Digit Properties. It also covers the **best API** for importing with **media and sender details**, and **multi-listing detection** with next/previous edit before saving.

---

## Best API for WhatsApp import (media + sender details)

**Recommended: WhatsApp Business Cloud API** (Meta), or **Twilio for WhatsApp**, both of which support:

- **Incoming message webhooks** – Your server receives every message sent to your business number.
- **Message content** – Full text body.
- **Media** – Images, video, documents with download URLs and metadata (MIME type, filename). You fetch the URL and optionally upload to Cloudinary for Digit Properties.
- **Sender details** – In the webhook payload:
  - `from` – Sender’s phone number (E.164).
  - `contacts[].profile.name` – Sender’s display name (when available).
  - `wa_id` – WhatsApp user ID.

So you get **listings with media** and **post sender details** (name, phone) for attribution or pre-filling agent/contact.

| Provider | API | Media | Sender (name, phone) | Use case |
|--------|-----|--------|----------------------|----------|
| **Meta WhatsApp Cloud API** | Webhooks | Yes (URL + metadata) | Yes (`from`, `profile.name`) | Full control, direct integration |
| **Twilio WhatsApp** | Webhooks | Yes | Yes | Simpler setup if you already use Twilio (e.g. Verify) |
| **360dialog / MessageBird** | Same Cloud API under the hood | Yes | Yes | Alternative BSPs |

**Implementation:** Add a webhook route (e.g. `POST /api/webhooks/whatsapp`) that:

1. Verifies the webhook (GET with `hub.mode`, `hub.verify_token`, `hub.challenge`) for Meta.
2. On POST, reads `entry[].changes[].value.messages[]`: `from`, `contacts`, `type`, `text.body`, and for media messages `image`/`video`/`document` with `id` (then call Media API to get URL).
3. Normalizes to `{ text, senderDetails: { name, phone, waId }, mediaUrls: [] }`.
4. Calls the same **parse** logic (single or multiple) and either creates draft listings with `createdByType: 'ai'` and optional `agentPhone`/`agentName` from sender, or pushes to a queue for an agent to review in the **Import from WhatsApp** UI (with next/previous edit and save all).

---

## 1. How to get content from WhatsApp

### 1.1 WhatsApp group messages

- **Personal / consumer WhatsApp:** There is **no official API** for reading messages from personal WhatsApp groups. Users cannot grant an app access to read their group chats.
- **Practical options:**
  1. **Manual copy‑paste:** Agents copy property messages from groups and paste them into Digit Properties (e.g. an “Import from WhatsApp” form). This is the most straightforward and works today.
  2. **WhatsApp Business API (receive only):** If you use a **business number** and users (or agents) **forward** property messages to that number, you can receive them via webhooks and process them automatically (see [§2.2](#22-whatsapp-business-api-webhook)).

### 1.2 WhatsApp status

- **Personal status:** No API to read other people’s status. Only the user can access their own status.
- **Business status (WhatsApp Business):** With the **WhatsApp Business API**, you can **post** status; reading status of other users is still not supported.
- **Practical option:** Agents who see a property on someone’s status can **copy the text (and save images)** and paste/upload them into Digit Properties’ import flow.

### 1.3 Summary

| Source              | How to get content                                      | Automated? |
|---------------------|----------------------------------------------------------|------------|
| WhatsApp groups     | Copy‑paste into Digit Properties; or forward to Business number → webhook | Manual or semi‑auto |
| WhatsApp status     | Copy text / save images, then paste/upload in app        | Manual     |

---

## 2. Architecture: Format and load

### 2.1 High‑level flow

1. **Ingest** – Raw text (and optionally images) from WhatsApp (paste, or webhook from Business API).
2. **Parse / format** – Extract structured fields: title, price, location (state, city, address), bedrooms, bathrooms, listing type (sale/rent), property type, contact (phone/name).
3. **Review** – Agent or admin reviews the parsed listing (edit if needed).
4. **Load** – Create or update a listing in Digit Properties (draft first, then publish if desired).

Digit Properties already has:

- **Listing model:** `title`, `description`, `listingType`, `propertyType`, `price`, `location` (address, city, state, suburb), `bedrooms`, `bathrooms`, `toilets`, `area`, `amenities`, `images`, `agentName`, `agentPhone`, `agentEmail`, etc.
- **Listing API:** `POST /api/listings` (authenticated user or admin) and `createdByType: 'admin' | 'ai' | 'user'` for attribution.

So “load” = call the same create/update APIs with the parsed payload; “format” = turn WhatsApp text into that payload.

### 2.2 WhatsApp Business API (webhook)

If you use **Twilio for WhatsApp** (or another provider that supports WhatsApp Business API):

1. Configure a **webhook URL** for incoming messages to your business number.
2. When someone forwards a property message (or sends one) to that number, your server receives a POST with message body and optional media.
3. Your server:
   - Takes the message **text** (and optionally media URLs).
   - Runs the **same parser** used for paste (see [§3](#3-format--parse)) to get a structured listing.
   - Either:
     - Saves to a **queue/table** for agent review, or
     - Creates a **draft listing** with `createdByType: 'ai'` and notifies an admin to review and publish.

This gives you “property from WhatsApp messages” with minimal manual step (forward to your number).

### 2.3 Loading into Digit Properties

- **Option A – Logged‑in agent:** Agent pastes in the app; parser fills the form; agent submits → `POST /api/listings` as that user (or admin). No new API needed.
- **Option B – Admin import (e.g. from webhook or bulk):** Admin-only endpoint that creates a listing with `createdByType: 'ai'`, optional `createdBy` set to an agent’s user ID, and optional tag/source like `whatsapp_import`. Listing is created as draft so an admin can assign and publish.

---

## 3. Format / parse

WhatsApp property text is usually unstructured, e.g.:

- “3bed flat for rent in Lekki 500k per year call 08012345678”
- “Duplex for sale at Chevron 45m, 5 bed 4 bath, contact Chidi”

Parsing options:

1. **Rule‑based (regex + heuristics)**  
   - Detect price (e.g. `5m`, `500k`, `₦1.5m`, `per year`, `per month`).  
   - Detect beds/baths (`3 bed`, `3br`, `2 bath`).  
   - Detect location: Nigerian state/city names (from `NIGERIAN_STATES` and a list of cities/areas).  
   - Detect listing type: “for rent” / “for sale” / “rent” / “sale”.  
   - Detect property type: apartment, duplex, house, etc.  
   - Detect phone: `080...`, `+234...`, `0xx...`.  
   - Use the rest as title/description.  
   - Implemented in `web/src/lib/whatsapp-listing-parser.ts` and exposed via **Parse from text** API below.

2. **LLM (optional)**  
   - Send the same text to an LLM with a prompt: “Extract: listingType, propertyType, price, state, city, address, bedrooms, bathrooms, agentPhone, agentName, title, description.”  
   - Map LLM output to your listing schema and validate (e.g. with Zod).  
   - Use for harder cases; keep rule‑based as fallback or first pass.

3. **Hybrid**  
   - Run rule‑based first; if confidence is low or fields missing, call LLM to fill gaps.

---

## 4. Implementation in Digit Properties

### 4.1 Parser and “parse only” API

- **Library:** `web/src/lib/whatsapp-listing-parser.ts`  
  - Input: raw string (e.g. from WhatsApp).  
  - Output: object that matches your listing payload (title, description, listingType, propertyType, price, location, bedrooms, bathrooms, agentPhone, etc.) plus optional `confidence` and `missing` fields.

- **API:** `POST /api/listings/parse-from-text`.  
  - **Single:** Body `{ "text": "..." }`. Response: `{ "parsed", "confidence", "missing" }`.  
  - **Multiple (and sender/media):** Body `{ "text": "...", "multiple": true, "senderDetails": { "name", "phone", "waId" }, "mediaUrls": ["https://..."] }`. Response: `{ "listings": [ { "parsed", "confidence", "missing" }, ... ], "senderDetails", "mediaUrls" }`.  
  - No listing is created; use this so the frontend can pre-fill the form(s) and support next/previous edit before saving.

### 4.2 Create listing from parsed data

- **Option 1:** Frontend uses parsed payload to fill the existing **listing form**; user/agent submits the form → existing `POST /api/listings` creates the listing. No backend change.
- **Option 2:** Add an **admin-only** “import” endpoint, e.g. `POST /api/admin/listings/import`, that:
  - Accepts the same payload as `POST /api/listings` plus optional `createdBy` (user ID to assign) and `source: "whatsapp"`.
  - Creates the listing with `createdByType: 'ai'`, `status: 'draft'`, and optional tags.
  - Used for webhook or bulk import where no human is logged in on the form.

### 4.3 “Import from WhatsApp” UI (dashboard)

- In dashboard (or admin), add a page/section **“Import from WhatsApp”**.
- One big **text area** for pasted message (and optional image uploads; images can be uploaded via existing upload API and URLs added to the listing).
- Button **“Parse”** → call `POST /api/listings/parse-from-text` with `multiple: true` → backend detects **multiple listings** in one post (by double newlines, numbered list, or dividers like `---`) and returns `listings[]` plus optional `senderDetails` and `mediaUrls`.
- User can **edit all posts** by pressing **Previous** / **Next** to move between listings; current form values are stored so nothing is lost.
- **Save all as drafts** → each listing is submitted to `POST /api/listings` (all as drafts). Optional sender details are shown at the top; media from the message can be attached to the first (or any) listing.

---

## 5. End‑to‑end: How agents get property from WhatsApp and load it

1. **From group or status:** Agent copies the property message (and saves images if needed).
2. **Open Digit Properties:** Dashboard → “Import from WhatsApp”.
3. **Paste** the text (and attach images if the UI supports it).
4. **Click “Parse”:** Backend returns structured listing; form is pre-filled.
5. **Edit** any missing or wrong fields (state, city, price, contact, etc.).
6. **Save as draft or Publish:** Listing is created and appears in “My listings” or admin listings; assign to an agent/user if using admin import.

If you later add a WhatsApp Business number and webhook:

- When someone forwards a message to that number, the server parses it and either creates a draft listing (`createdByType: 'ai'`) or adds it to a queue for an agent to review and then load into Digit Properties using the same flow above.

---

## 6. Multiple listings in one post

The parser **splits one post** into blocks by:

- Double newlines (`\n\n`),
- Numbered lines (e.g. `1.` `2.` or `1)` `2)`),
- Dividers (`---`, `***`, `___`),

then runs the single-listing parser on each block. Low-confidence blocks (no price, no beds, very short) are dropped. Implemented in `parseMultipleWhatsAppListings()` in `web/src/lib/whatsapp-listing-parser.ts`.

The **Import from WhatsApp** UI always calls the API with `multiple: true`, shows “Listing 1 of N” with **Previous** / **Next**, and **Save all as drafts** to create every listing after the user has edited each one.

---

## 7. References

- [WhatsApp Cloud API – Webhooks](https://developers.facebook.com/docs/whatsapp/cloud-api/webhooks) – payload examples (message, media, contacts).
- [Twilio WhatsApp](https://www.twilio.com/docs/whatsapp) – receiving messages via webhook.
- [WhatsApp Business API](https://developers.facebook.com/docs/whatsapp/cloud-api) – Cloud API for business accounts.
- Existing Digit Properties: `web/src/models/Listing.ts`, `POST /api/listings`, `web/src/lib/validations.ts` (listing schema).
