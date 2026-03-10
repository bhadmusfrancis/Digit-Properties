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
/** 'sms' or 'whatsapp'. Use sms while WhatsApp profile is pending approval. */
const TWILIO_VERIFY_CHANNEL = (process.env.TWILIO_VERIFY_CHANNEL || 'sms').toLowerCase() as 'sms' | 'whatsapp';

/** Nigerian phone: 234 + 10 digits = 13 digits total. Required for reliable SMS/WhatsApp delivery. */
export const NIGERIAN_PHONE_LENGTH = 13;
const NIGERIAN_PREFIX = '234';

/**
 * Normalize to Nigerian E.164 (no +): 234XXXXXXXXXX (13 digits).
 * Accepts: 08012345678, 8012345678, 2348012345678, +234 801 234 5678.
 */
export function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.startsWith('234') && digits.length >= 13) return digits.slice(0, 13);
  if (digits.startsWith('234')) return digits.length > 13 ? digits.slice(0, 13) : digits;
  if (digits.startsWith('0') && digits.length === 11) return NIGERIAN_PREFIX + digits.slice(1);
  if (digits.length === 10) return NIGERIAN_PREFIX + digits;
  if (digits.startsWith('0')) return NIGERIAN_PREFIX + digits.slice(1);
  return NIGERIAN_PREFIX + digits;
}

/** E.164 with + for Twilio (e.g. +2348012345678). */
export function toE164(phone: string): string {
  return '+' + normalizePhone(phone);
}

/** True if normalized Nigerian number (234 + 10 digits). Use after normalizePhone. */
export function isValidNigerianPhone(normalized: string): boolean {
  return (
    normalized.length === NIGERIAN_PHONE_LENGTH &&
    normalized.startsWith(NIGERIAN_PREFIX) &&
    /^\d+$/.test(normalized)
  );
}

/** Format for display: +234 801 234 5678 */
export function formatPhoneDisplay(normalized: string): string {
  if (!isValidNigerianPhone(normalized)) return normalized;
  return `+234 ${normalized.slice(3, 6)} ${normalized.slice(6, 9)} ${normalized.slice(9)}`;
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
 * Send OTP via Twilio Verify API (channel: sms or whatsapp from TWILIO_VERIFY_CHANNEL).
 * Use checkTwilioVerifyCode in confirm-phone. Set TWILIO_VERIFY_CHANNEL=sms for SMS OTP.
 */
export async function sendPhoneOtpViaTwilio(
  phone: string,
  channel: 'sms' | 'whatsapp' = TWILIO_VERIFY_CHANNEL
): Promise<{ ok: boolean; error?: string; channel?: 'sms' | 'whatsapp' }> {
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
      body: new URLSearchParams({ To: to, Channel: channel }).toString(),
    });
    const data = await res.json();
    if (!res.ok) {
      const msg = (data as { message?: string }).message || JSON.stringify(data);
      return { ok: false, error: msg };
    }
    return { ok: true, channel };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: msg };
  }
}

/** @deprecated Use sendPhoneOtpViaTwilio (supports sms and whatsapp via TWILIO_VERIFY_CHANNEL). */
export const sendPhoneOtpViaTwilioWhatsApp = (phone: string) =>
  sendPhoneOtpViaTwilio(phone, 'whatsapp');

/**
 * Verify the code the user entered against Twilio Verify (SMS or WhatsApp OTP).
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
