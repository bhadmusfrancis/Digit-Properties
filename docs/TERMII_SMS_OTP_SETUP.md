# Termii SMS OTP Setup

Use **Termii** to send phone verification OTP via SMS (Nigeria-focused). The app uses Termii when **Twilio is not configured**; if both are set, Twilio is tried first.

---

## 1. Create a Termii account

1. Go to **[termii.com](https://termii.com)** and sign up (email, password, name).
2. Verify your email and complete your profile (business info).
3. Add a payment method and fund your account (SMS is paid per message).

---

## 2. Get your API key

1. Log in to **[Termii Dashboard](https://accounts.termii.com)** (or [accounts.termii.com](https://accounts.termii.com)).
2. Go to **API** or **Settings** and copy your **API key** (long string).
3. Keep it secret; use it only in server env (e.g. `TERMII_API_KEY`).

---

## 3. Sender ID (required for SMS)

Termii requires an approved **Sender ID** (the name that appears as the sender, e.g. `DigitProp`).

- **Option A – Use Termii’s default:** Some accounts can send with a shared/default sender; check the dashboard.
- **Option B – Register your own:** In Termii, request a Sender ID (e.g. **DigitProp**, 3–11 alphanumeric). Approval can take a few days. Use it as `TERMII_SENDER_ID`.

Docs: [Termii Sender ID](https://developers.termii.com/sender-id).

---

## 4. Environment variables

In **`web/.env.local`** (and in **Vercel** for production):

```env
# Termii – SMS OTP (used when Twilio is not set, or after Twilio fails)
TERMII_API_KEY=your_termii_api_key_here
TERMII_SENDER_ID=DigitProp
# Channel: dnd = SMS (default, use for OTP). Optional.
# TERMII_CHANNEL=dnd
```

| Variable           | Required | Description |
|--------------------|----------|-------------|
| `TERMII_API_KEY`   | Yes      | Your Termii API key from the dashboard. |
| `TERMII_SENDER_ID` | Yes      | Approved Sender ID (e.g. `DigitProp`). Default in code: `DigitProp`. |
| `TERMII_CHANNEL`   | No       | `dnd` = SMS (default). Use for OTP. |

---

## 5. Flow in the app

- **Verify phone:** User enters number → `POST /api/me/verify-phone`.
- If **Twilio** is configured, Twilio (SMS/WhatsApp) is used first.
- If Twilio is not set or fails, the app tries **Termii**: sends a 6-digit OTP via SMS using `TERMII_API_KEY` and `TERMII_SENDER_ID`.
- User enters the code → `POST /api/me/confirm-phone` with `{ "code": "123456" }`.

Phone numbers are normalized to Nigerian format (e.g. `2348012345678`).

---

## 6. References

- [Termii Messaging API](https://developers.termii.com/messaging-api)
- [Termii Send Token (OTP)](https://developer.termii.com/send-token)
- [Termii Sender ID](https://developers.termii.com/sender-id)
