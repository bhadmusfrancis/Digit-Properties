import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { getSession } from '@/lib/get-session';
import { dbConnect } from '@/lib/db';
import User from '@/models/User';
import { consumeRateLimit } from '@/lib/rate-limit';
import { checkTwilioVerifyCode } from '@/lib/phone-verify';
import { confirmPhoneSchema } from '@/lib/validations';

/** POST /api/me/confirm-phone — verify OTP code (WhatsApp/SMS) and set phoneVerifiedAt */
export async function POST(req: Request) {
  try {
    const session = await getSession(req);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const rate = consumeRateLimit(req, 'confirm-phone');
    if (!rate.allowed) {
      return NextResponse.json(
        { error: 'Too many attempts. Try again later.' },
        { status: 429 }
      );
    }
    const body = await req.json().catch(() => ({}));
    const parsed = confirmPhoneSchema.safeParse(body);
    if (!parsed.success) {
      const first = parsed.error.errors[0];
      return NextResponse.json({ error: first?.message ?? 'Invalid code' }, { status: 400 });
    }
    const code = parsed.data.code;
    await dbConnect();
    const user = await User.findById(session.user.id);
    if (!user) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    if (user.phoneVerificationProvider === 'twilio') {
      if (!user.phone || !user.phoneVerificationExpires || new Date() > user.phoneVerificationExpires) {
        user.phoneVerificationProvider = undefined;
        user.phoneVerificationExpires = undefined;
        await user.save();
        return NextResponse.json({ error: 'Verification expired. Request a new code.' }, { status: 400 });
      }
      const check = await checkTwilioVerifyCode(user.phone, code);
      if (!check.ok) {
        return NextResponse.json({ error: check.error || 'Invalid code' }, { status: 400 });
      }
      user.phoneVerifiedAt = new Date();
      user.phoneVerificationProvider = undefined;
      user.phoneVerificationExpires = undefined;
      await user.save();
      return NextResponse.json({ ok: true, message: 'Phone verified.' });
    }

    if (!user.phoneVerificationCode || !user.phoneVerificationExpires) {
      return NextResponse.json({ error: 'No pending verification. Request a new code.' }, { status: 400 });
    }
    if (new Date() > user.phoneVerificationExpires) {
      user.phoneVerificationCode = undefined;
      user.phoneVerificationExpires = undefined;
      user.phoneVerificationToken = undefined;
      await user.save();
      return NextResponse.json({ error: 'Code expired. Request a new code.' }, { status: 400 });
    }
    const valid = await bcrypt.compare(code, user.phoneVerificationCode);
    if (!valid) {
      return NextResponse.json({ error: 'Invalid code' }, { status: 400 });
    }
    user.phoneVerifiedAt = new Date();
    user.phoneVerificationCode = undefined;
    user.phoneVerificationExpires = undefined;
    user.phoneVerificationToken = undefined;
    await user.save();
    return NextResponse.json({ ok: true, message: 'Phone verified.' });
  } catch (e) {
    console.error('[confirm-phone]', e);
    return NextResponse.json({ error: 'Verification failed' }, { status: 500 });
  }
}
