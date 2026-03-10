# Twilio Verify: SMS or WhatsApp OTP

The app can send a **6-digit OTP** via **Twilio Verify API** and verify the code the user enters.

- **SMS (default):** Set `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_VERIFY_SERVICE_SID`. No WhatsApp approval needed. Use `TWILIO_VERIFY_CHANNEL=sms` or leave it unset.
- **WhatsApp:** Set `TWILIO_VERIFY_CHANNEL=whatsapp` and add a WhatsApp Sender to your Verify service (requires Meta approval). Until then, use SMS.

## Flow

1. User enters phone number (e.g. 08012345678 or +2348012345678).
2. Backend calls Twilio Verify: **Create Verification** with `Channel: whatsapp` and the user’s number in E.164.
3. Twilio sends the OTP to that number **via WhatsApp**.
4. User enters the 6-digit code in the app.
5. Backend calls Twilio Verify: **Verification Check** with the same number and code.
6. If status is `approved`, we set `phoneVerifiedAt` on the user.

## Setup

### 1. Twilio account

- Sign up at [twilio.com](https://www.twilio.com).
- Get **Account SID** and **Auth Token** from the Twilio Console.

### 2. Verify service

- In Twilio Console go to **Verify** → **Services** → create a service (e.g. “Digit Properties WhatsApp”).
- Copy the **Service SID** (starts with `VA...`).

### 3. WhatsApp sender (required for WhatsApp channel)

- Twilio needs a **WhatsApp Sender** linked to your Verify service (WhatsApp Business Account).
- In Twilio: **Messaging** → **Try it out** → **Send a WhatsApp message**, or **Verify** → your service → **Senders**.
- Add and connect a **WhatsApp Business Account** (Meta Business Suite). Approval can take from about 1 hour (if already Meta-verified) to a few days.
- Link that WhatsApp sender to your **Verify** service so the service can send WhatsApp verifications.

### 4. Environment variables

In `.env.local` (or your env):

```env
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=your_auth_token
TWILIO_VERIFY_SERVICE_SID=VAxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
# Optional: sms (default) or whatsapp. Use sms until WhatsApp profile is approved.
# TWILIO_VERIFY_CHANNEL=sms
```

- If these are set, the app uses **Twilio Verify** for phone verification (SMS by default, or WhatsApp when `TWILIO_VERIFY_CHANNEL=whatsapp` and WhatsApp sender is linked).
- If not set, it falls back to Termii (if configured) or to **verification link by email**.

## Behaviour in the app

- **Verify phone (send code):**  
  `POST /api/me/verify-phone` with `{ "phone": "08012345678" }`.  
  If Twilio is configured, it sends the OTP via SMS (default) or WhatsApp and returns e.g.  
  `{ "ok": true, "message": "Verification code sent to your phone via SMS. Enter the code below.", "channel": "sms" }` (or `channel: "whatsapp"` when using WhatsApp).

- **Confirm code:**  
  `POST /api/me/confirm-phone` with `{ "code": "123456" }`.  
  Backend calls Twilio Verification Check; on success it sets `phoneVerifiedAt` and clears the pending verification.

## Phone number format

- Backend normalizes to E.164 (e.g. `+2348012345678`) for Twilio.
- Nigerian numbers: `08012345678`, `8012345678`, `+2348012345678` are all accepted.

## Fallbacks (when Twilio is not configured)

1. **Termii** – If `TERMII_API_KEY` (and related) are set, the app sends the OTP via Termii (SMS or WhatsApp if Termii supports it).
2. **Email link** – If neither Twilio nor Termii is configured, the app emails a one-time verification link to the user; they open it to verify (e.g. on their phone).

## References

- [Twilio Verify – WhatsApp](https://www.twilio.com/docs/verify/whatsapp)
- [Twilio Verify API – Create Verification](https://www.twilio.com/docs/verify/api/verification)
- [Twilio Verify API – Verification Check](https://www.twilio.com/docs/verify/api/verification-check)
