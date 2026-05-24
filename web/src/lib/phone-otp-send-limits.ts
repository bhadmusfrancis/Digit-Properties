import { PHONE_OTP_COOLDOWN_MS } from '@/lib/phone-verify';

/** Max SMS OTP sends per user per UTC calendar day (claim + account verification). */
export const PHONE_OTP_MAX_SENDS_PER_DAY = 2;

export { PHONE_OTP_COOLDOWN_MS };

export function utcCalendarDayKey(d = new Date()): string {
  return d.toISOString().slice(0, 10);
}

export function nextUtcMidnight(from = new Date()): Date {
  return new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate() + 1, 0, 0, 0, 0));
}

export type PhoneOtpSendDeny = {
  code: 'OTP_COOLDOWN' | 'OTP_DAILY_LIMIT';
  error: string;
  retryAfter?: string;
};

export function assertPhoneOtpCooldown(
  lastSendAt: Date | undefined | null,
  now = Date.now()
): PhoneOtpSendDeny | null {
  if (!lastSendAt) return null;
  const elapsed = now - new Date(lastSendAt).getTime();
  if (elapsed < PHONE_OTP_COOLDOWN_MS) {
    const retryAt = new Date(lastSendAt.getTime() + PHONE_OTP_COOLDOWN_MS);
    const waitMinutes = Math.max(1, Math.ceil((PHONE_OTP_COOLDOWN_MS - elapsed) / 60000));
    return {
      code: 'OTP_COOLDOWN',
      error: `Please wait ${waitMinutes} minute(s) before requesting another code.`,
      retryAfter: retryAt.toISOString(),
    };
  }
  return null;
}

export function assertPhoneOtpDailyCap(
  sendsDayKey: string | undefined | null,
  sendsCount: number | undefined | null
): PhoneOtpSendDeny | null {
  const today = utcCalendarDayKey();
  const countForToday = sendsDayKey === today ? (sendsCount ?? 0) : 0;
  if (countForToday >= PHONE_OTP_MAX_SENDS_PER_DAY) {
    return {
      code: 'OTP_DAILY_LIMIT',
      error: `You can receive at most ${PHONE_OTP_MAX_SENDS_PER_DAY} verification codes per calendar day (UTC). Try again after midnight UTC.`,
      retryAfter: nextUtcMidnight().toISOString(),
    };
  }
  return null;
}

export function nextPhoneOtpSendsCount(
  sendsDayKey: string | undefined | null,
  sendsCount: number | undefined | null,
  now = new Date()
): { sendsDayKey: string; sendsCount: number } {
  const today = utcCalendarDayKey(now);
  const prev = sendsDayKey === today ? (sendsCount ?? 0) : 0;
  return { sendsDayKey: today, sendsCount: prev + 1 };
}
