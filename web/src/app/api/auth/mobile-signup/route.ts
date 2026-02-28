import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { dbConnect } from '@/lib/db';
import User from '@/models/User';
import { registerSchema } from '@/lib/validations';
import { USER_ROLES } from '@/lib/constants';
import { sendWelcomeEmail, sendAdminNewUser, sendVerificationEmail } from '@/lib/email';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://digitproperties.com';
const VERIFY_EXPIRY_HOURS = 24;

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const parsed = registerSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
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
      console.error('[mobile-signup] verification email:', e)
    );
    await sendWelcomeEmail(email, name).catch((e) => console.error('[mobile-signup] welcome email:', e));
    await sendAdminNewUser(name, email).catch((e) => console.error('[mobile-signup] admin email:', e));
    return NextResponse.json({
      needVerification: true,
      email: user.email,
      message: 'Check your email to verify your account before signing in.',
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Sign up failed' }, { status: 500 });
  }
}
