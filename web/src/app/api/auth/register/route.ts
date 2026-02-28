import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { dbConnect } from '@/lib/db';
import User from '@/models/User';
import { registerSchema } from '@/lib/validations';
import { USER_ROLES } from '@/lib/constants';
import { sendWelcomeEmail, sendAdminNewUser, sendVerificationEmail } from '@/lib/email';
import { verifyRecaptcha } from '@/lib/recaptcha';
import { consumeRateLimit } from '@/lib/rate-limit';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://digitproperties.com';
const VERIFY_EXPIRY_HOURS = 24;
const REGISTER_RATE_PREFIX = 'register';

export async function POST(req: Request) {
  try {
    const rate = consumeRateLimit(req, REGISTER_RATE_PREFIX);
    if (!rate.allowed) {
      return NextResponse.json(
        { error: 'Too many registration attempts. Please try again later.' },
        { status: 429, headers: rate.retryAfter ? { 'Retry-After': String(rate.retryAfter) } : undefined }
      );
    }

    const body = await req.json();
    const honeypot = typeof body.website === 'string' ? body.website.trim() : '';
    if (honeypot) {
      return NextResponse.json({ error: 'Registration failed' }, { status: 400 });
    }

    const captchaToken = typeof body.captchaToken === 'string' ? body.captchaToken.trim() : '';
    if (process.env.RECAPTCHA_SECRET_KEY) {
      if (!captchaToken) {
        return NextResponse.json(
          { error: 'Security check required. Please complete the verification and try again.' },
          { status: 400 }
        );
      }
      const captcha = await verifyRecaptcha(captchaToken);
      if (!captcha.success) {
        return NextResponse.json(
          { error: 'Security check failed. Please try again.' },
          { status: 400 }
        );
      }
    }

    const parsed = registerSchema.safeParse({
      email: body.email,
      name: body.name,
      password: body.password,
    });
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }
    const { email, name, password } = parsed.data;
    await dbConnect();
    const existing = await User.findOne({ email });
    if (existing) {
      return NextResponse.json({ error: 'Email already registered' }, { status: 400 });
    }
    const hashed = await bcrypt.hash(password, 12);
    const emailVerificationToken = crypto.randomBytes(32).toString('hex');
    const emailVerificationExpires = new Date(Date.now() + VERIFY_EXPIRY_HOURS * 60 * 60 * 1000);
    const user = await User.create({
      email,
      name,
      password: hashed,
      role: USER_ROLES.GUEST,
      emailVerificationToken,
      emailVerificationExpires,
    });
    const verifyUrl = `${APP_URL}/api/auth/verify-email?token=${encodeURIComponent(emailVerificationToken)}`;
    await sendVerificationEmail(email, name, verifyUrl).catch((e) =>
      console.error('[register] verification email:', e)
    );
    await sendWelcomeEmail(email, name).catch((e) => console.error('[register] welcome email:', e));
    await sendAdminNewUser(name, email).catch((e) => console.error('[register] admin email:', e));
    return NextResponse.json({
      id: user._id,
      email: user.email,
      name: user.name,
      role: user.role,
      needVerification: true,
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Registration failed' }, { status: 500 });
  }
}
