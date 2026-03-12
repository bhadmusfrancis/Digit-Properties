# Termii SMS OTP Setup

Use **Termii** for phone verification via SMS (Nigeria-focused). The app sends: **"Your Digit Properties Verification Pin is XXXXXX. It expires in 30 minutes."**  
Termii is tried **first** when configured; Twilio is used if Termii is not set. Users cannot request a new code within **30 minutes** of the last send (cooldown, same as OTP expiry).

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
# Termii – required for SMS verification
TERMII_API_KEY=your_termii_api_key_here
TERMII_SENDER_ID=DigitProp
# Optional
# TERMII_CHANNEL=dnd
# TERMII_BASE_URL=https://api.termii.com
```

| Variable            | Required | Description |
|---------------------|----------|-------------|
| `TERMII_API_KEY`    | **Yes**  | Your Termii API key from the [Termii dashboard](https://accounts.termii.com). |
| `TERMII_SENDER_ID`  | **Yes**  | Approved Sender ID (e.g. `DigitProp`). Default in code: `DigitProp`. |
| `TERMII_CHANNEL`    | No       | `dnd` = SMS (default). Use for OTP. |
| `TERMII_BASE_URL`   | No       | API base URL. Default: `https://api.termii.com`. |

---

## 5. Flow in the app

- **Verify phone:** User enters number → `POST /api/me/verify-phone`.
- If **Termii** is configured (`TERMII_API_KEY` + `TERMII_SENDER_ID`), the app sends the SMS via Termii: *"Your Digit Properties Verification Pin is XXXXXX. It expires in 30 minutes."*
- **Cooldown:** Another code cannot be requested within 30 minutes of the previous send (same as OTP expiry).
- If Termii is not set or fails, **Twilio** (SMS/WhatsApp) is tried next.
- User enters the code → `POST /api/me/confirm-phone` with `{ "code": "123456" }`.

Phone numbers are normalized to Nigerian format (e.g. `2348012345678`).

---

## 6. References

- [Termii Messaging API](https://developers.termii.com/messaging-api)
- [Termii Send Token (OTP)](https://developer.termii.com/send-token)
- [Termii Sender ID](https://developers.termii.com/sender-id)
