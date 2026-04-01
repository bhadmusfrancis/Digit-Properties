import mongoose from 'mongoose';
import ClaimOtpUserState from '@/models/ClaimOtpUserState';

const COOLDOWN_MS = 30 * 60 * 1000;
const MAX_SENDS_PER_DAY = 2;
const MAX_CONSECUTIVE_VERIFY_FAILURES = 5;
/** No specification from product; 24h lockout after 5 failed OTP attempts */
const LOCKOUT_MS = 24 * 60 * 60 * 1000;

export function utcCalendarDayKey(d = new Date()): string {
  return d.toISOString().slice(0, 10);
}

function nextUtcMidnight(from = new Date()): Date {
  return new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate() + 1, 0, 0, 0, 0));
}

export type OtpThrottleDeny = {
  code: 'OTP_LOCKED' | 'OTP_COOLDOWN' | 'OTP_DAILY_LIMIT';
  error: string;
  retryAfter?: string;
};

async function getStateClearedIfUnlocked(userId: string): Promise<InstanceType<typeof ClaimOtpUserState> | null> {
  if (!mongoose.Types.ObjectId.isValid(userId)) return null;
  const oid = new mongoose.Types.ObjectId(userId);
  const s = await ClaimOtpUserState.findOne({ userId: oid });
  if (!s) return null;
  const now = new Date();
  if (s.lockedUntil && s.lockedUntil <= now) {
    s.lockedUntil = undefined;
    s.consecutiveVerifyFailures = 0;
    await s.save();
  }
  return s;
}

export async function assertClaimOtpNotLocked(userId: string): Promise<OtpThrottleDeny | null> {
  const state = await getStateClearedIfUnlocked(userId);
  if (state?.lockedUntil && state.lockedUntil > new Date()) {
    return {
      code: 'OTP_LOCKED',
      error:
        'Too many failed verification attempts. Claim SMS codes are disabled for your account for 24 hours. Try again after that.',
      retryAfter: state.lockedUntil.toISOString(),
    };
  }
  return null;
}

export async function assertCanSendClaimOtp(userId: string): Promise<OtpThrottleDeny | null> {
  const locked = await assertClaimOtpNotLocked(userId);
  if (locked) return locked;

  const state = await ClaimOtpUserState.findOne({ userId: new mongoose.Types.ObjectId(userId) });
  const now = Date.now();

  if (state?.lastSendAt) {
    const elapsed = now - state.lastSendAt.getTime();
    if (elapsed < COOLDOWN_MS) {
      const retryAt = new Date(state.lastSendAt.getTime() + COOLDOWN_MS);
      const mins = Math.max(1, Math.ceil((COOLDOWN_MS - elapsed) / 60000));
      return {
        code: 'OTP_COOLDOWN',
        error: `Please wait ${mins} minute(s) before requesting another code (30-minute minimum between SMS codes).`,
        retryAfter: retryAt.toISOString(),
      };
    }
  }

  const today = utcCalendarDayKey();
  const countForToday = state?.sendsDayKey === today ? (state.sendsCount ?? 0) : 0;
  if (countForToday >= MAX_SENDS_PER_DAY) {
    return {
      code: 'OTP_DAILY_LIMIT',
      error: 'You can receive at most 2 claim verification codes per calendar day (UTC). Try again after midnight UTC.',
      retryAfter: nextUtcMidnight().toISOString(),
    };
  }

  return null;
}

export async function recordClaimOtpSent(userId: string): Promise<void> {
  if (!mongoose.Types.ObjectId.isValid(userId)) return;
  const oid = new mongoose.Types.ObjectId(userId);
  const today = utcCalendarDayKey();
  const now = new Date();

  let s = await ClaimOtpUserState.findOne({ userId: oid });
  if (!s) {
    await ClaimOtpUserState.create({
      userId: oid,
      lastSendAt: now,
      sendsDayKey: today,
      sendsCount: 1,
      consecutiveVerifyFailures: 0,
    });
    return;
  }
  if (s.sendsDayKey !== today) {
    s.sendsDayKey = today;
    s.sendsCount = 0;
  }
  s.sendsCount = (s.sendsCount ?? 0) + 1;
  s.lastSendAt = now;
  await s.save();
}

export async function recordClaimVerifyFailure(userId: string): Promise<{ lockedUntil: Date | null }> {
  if (!mongoose.Types.ObjectId.isValid(userId)) return { lockedUntil: null };
  const oid = new mongoose.Types.ObjectId(userId);

  let s = await ClaimOtpUserState.findOne({ userId: oid });
  if (!s) {
    s = await ClaimOtpUserState.create({
      userId: oid,
      sendsCount: 0,
      consecutiveVerifyFailures: 1,
    });
  } else {
    s.consecutiveVerifyFailures = (s.consecutiveVerifyFailures ?? 0) + 1;
  }

  let lockedUntil: Date | null = null;
  if (s.consecutiveVerifyFailures >= MAX_CONSECUTIVE_VERIFY_FAILURES) {
    lockedUntil = new Date(Date.now() + LOCKOUT_MS);
    s.lockedUntil = lockedUntil;
  }
  await s.save();
  return { lockedUntil };
}

export async function recordClaimVerifySuccess(userId: string): Promise<void> {
  if (!mongoose.Types.ObjectId.isValid(userId)) return;
  const oid = new mongoose.Types.ObjectId(userId);
  await ClaimOtpUserState.updateOne(
    { userId: oid },
    {
      $set: { consecutiveVerifyFailures: 0 },
      $unset: { lockedUntil: 1 },
      $setOnInsert: { userId: oid, sendsCount: 0 },
    },
    { upsert: true }
  );
}
