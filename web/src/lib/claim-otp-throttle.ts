import mongoose from 'mongoose';
import ClaimOtpUserState from '@/models/ClaimOtpUserState';
import {
  PHONE_OTP_COOLDOWN_MS,
  PHONE_OTP_MAX_SENDS_PER_DAY,
  assertPhoneOtpCooldown,
  assertPhoneOtpDailyCap,
  nextPhoneOtpSendsCount,
} from '@/lib/phone-otp-send-limits';
import {
  PHONE_OTP_RATE_LIMIT_MAX_ATTEMPTS,
  PHONE_OTP_RATE_LIMIT_WINDOW_MS,
} from '@/lib/rate-limit';

export {
  PHONE_OTP_COOLDOWN_MS as CLAIM_OTP_COOLDOWN_MS,
  PHONE_OTP_MAX_SENDS_PER_DAY as CLAIM_OTP_MAX_SENDS_PER_DAY,
};
export const CLAIM_OTP_RATE_LIMIT_MAX = PHONE_OTP_RATE_LIMIT_MAX_ATTEMPTS;
export const CLAIM_OTP_RATE_LIMIT_WINDOW_MS = PHONE_OTP_RATE_LIMIT_WINDOW_MS;

const MAX_CONSECUTIVE_VERIFY_FAILURES = 5;
const LOCKOUT_MS = 24 * 60 * 60 * 1000;

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
        'Too many failed verification attempts. Claim verification is disabled for your account for 24 hours. Try again after that.',
      retryAfter: state.lockedUntil.toISOString(),
    };
  }
  return null;
}

export async function assertCanSendClaimOtp(userId: string): Promise<OtpThrottleDeny | null> {
  const locked = await assertClaimOtpNotLocked(userId);
  if (locked) return locked;

  const state = await ClaimOtpUserState.findOne({ userId: new mongoose.Types.ObjectId(userId) });

  const daily = assertPhoneOtpDailyCap(state?.sendsDayKey, state?.sendsCount);
  if (daily) return daily;

  const cooldown = assertPhoneOtpCooldown(state?.lastSendAt);
  if (cooldown) return cooldown;

  return null;
}

export async function recordClaimOtpSent(userId: string): Promise<void> {
  if (!mongoose.Types.ObjectId.isValid(userId)) return;
  const oid = new mongoose.Types.ObjectId(userId);
  const now = new Date();

  let s = await ClaimOtpUserState.findOne({ userId: oid });
  if (!s) {
    const { sendsDayKey, sendsCount } = nextPhoneOtpSendsCount(undefined, 0, now);
    await ClaimOtpUserState.create({
      userId: oid,
      lastSendAt: now,
      sendsDayKey,
      sendsCount,
      consecutiveVerifyFailures: 0,
    });
    return;
  }
  const { sendsDayKey, sendsCount } = nextPhoneOtpSendsCount(s.sendsDayKey, s.sendsCount, now);
  s.lastSendAt = now;
  s.sendsDayKey = sendsDayKey;
  s.sendsCount = sendsCount;
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
