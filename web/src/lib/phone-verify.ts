/**
 * Phone verification: send OTP via WhatsApp (Twilio Verify) or Termii (SMS/WhatsApp), or verification link.
 * - WhatsApp OTP: set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_VERIFY_SERVICE_SID (Twilio Verify sends code to WhatsApp).
 * - Termii: set TERMII_API_KEY, TERMII_SENDER_ID; use TERMII_CHANNEL=whatsapp if supported.
 */

import crypto from 'crypto';

const TERMII_API_KEY = process.env.TERMII_API_KEY;
const TERMII_SENDER_ID = process.env.TERMII_SENDER_ID || 'DigitProp';
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://digitproperties.com';

const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID;
const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN;
const TWILIO_VERIFY_SERVICE_SID = process.env.TWILIO_VERIFY_SERVICE_SID;

/** Normalize to E.164 for Twilio: +234XXXXXXXXXX. For internal (no +) use normalizePhoneNoPlus. */
export function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.startsWith('234')) return digits;
  if (digits.startsWith('0')) return '234' + digits.slice(1);
  if (digits.length === 10) return '234' + digits;
  return '234' + digits;
}

/** E.164 with + for Twilio */
export function toE164(phone: string): string {
  return '+' + normalizePhone(phone);
}

const OTP_LENGTH = 6;
const OTP_EXPIRY_MINUTES = 10;

/**
 * Generate a numeric OTP and optional verification link (token).
 * Returns { code, token, expiresAt }. Store hashed code or token on User; send code via Termii.
 */
export function generatePhoneVerification(): {
  code: string;
  token: string;
  expiresAt: Date;
} {
  const code = Array.from({ length: OTP_LENGTH }, () =>
    Math.floor(Math.random() * 10)
  ).join('');
  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);
  return { code, token, expiresAt };
}

/**
 * Send OTP via Termii (SMS or WhatsApp). Uses channel 'dnd' for SMS; use 'whatsapp' if Termii supports it.
 * Returns { ok, error? }. If TERMII_API_KEY not set, returns ok: false (caller can fall back to link).
 */
export async function sendPhoneOtp(
  phone: string,
  code: string
): Promise<{ ok: boolean; error?: string }> {
  if (!TERMII_API_KEY) {
    return { ok: false, error: 'TERMII_API_KEY not set' };
  }
  const to = normalizePhone(phone);
  const channel = process.env.TERMII_CHANNEL || 'dnd'; // dnd = SMS; whatsapp if available
  try {
    const res = await fetch('https://api.termii.com/api/sms/otp/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: TERMII_API_KEY,
        to,
        from: TERMII_SENDER_ID,
        pin_type: 'NUMERIC',
        pin_length: OTP_LENGTH,
        pin_time_to_live: OTP_EXPIRY_MINUTES,
        pin_attempts: 5,
        pin_placeholder: '< _ _ _ _ _ _ >',
        message_text: `Your ${process.env.NEXT_PUBLIC_APP_NAME || 'Digit Properties'} verification code is: ${code}. Valid for ${OTP_EXPIRY_MINUTES} minutes.`,
        channel,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      const msg = (data as { message?: string }).message || JSON.stringify(data);
      return { ok: false, error: msg };
    }
    return { ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: msg };
  }
}

/**
 * Build verification link for phone (fallback when OTP not sent). User clicks to set phoneVerifiedAt.
 */
export function getPhoneVerificationLink(token: string): string {
  return `${APP_URL}/api/auth/verify-phone?token=${encodeURIComponent(token)}`;
}

/**
 * Send OTP to the user's WhatsApp number via Twilio Verify API (channel: whatsapp).
 * The code is generated and verified by Twilio; use checkTwilioVerifyCode in confirm-phone.
 */
export async function sendPhoneOtpViaTwilioWhatsApp(
  phone: string
): Promise<{ ok: boolean; error?: string }> {
  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_VERIFY_SERVICE_SID) {
    return { ok: false, error: 'Twilio Verify not configured' };
  }
  const to = toE164(phone);
  const auth = Buffer.from(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`).toString('base64');
  const url = `https://verify.twilio.com/v2/Services/${TWILIO_VERIFY_SERVICE_SID}/Verifications`;
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${auth}`,
      },
      body: new URLSearchParams({ To: to, Channel: 'whatsapp' }).toString(),
    });
    const data = await res.json();
    if (!res.ok) {
      const msg = (data as { message?: string }).message || JSON.stringify(data);
      return { ok: false, error: msg };
    }
    return { ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: msg };
  }
}

/**
 * Verify the code the user entered against Twilio Verify (for WhatsApp OTP).
 */
export async function checkTwilioVerifyCode(
  phone: string,
  code: string
): Promise<{ ok: boolean; error?: string }> {
  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_VERIFY_SERVICE_SID) {
    return { ok: false, error: 'Twilio Verify not configured' };
  }
  const to = toE164(phone);
  const auth = Buffer.from(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`).toString('base64');
  const url = `https://verify.twilio.com/v2/Services/${TWILIO_VERIFY_SERVICE_SID}/VerificationCheck`;
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${auth}`,
      },
      body: new URLSearchParams({ To: to, Code: code.replace(/\D/g, '') }).toString(),
    });
    const data = await res.json();
    if (!res.ok) {
      const msg = (data as { message?: string }).message || JSON.stringify(data);
      return { ok: false, error: msg };
    }
    const status = (data as { status?: string }).status;
    if (status !== 'approved') {
      return { ok: false, error: 'Invalid or expired code' };
    }
    return { ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: msg };
  }
}

export function isTwilioVerifyConfigured(): boolean {
  return !!(TWILIO_ACCOUNT_SID && TWILIO_AUTH_TOKEN && TWILIO_VERIFY_SERVICE_SID);
}
