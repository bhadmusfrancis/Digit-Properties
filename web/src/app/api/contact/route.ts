import { NextResponse } from 'next/server';
import { sendContactFormEmail } from '@/lib/email';

const RECAPTCHA_MIN_SCORE = 0.5;

async function verifyRecaptcha(token: string): Promise<{ success: boolean }> {
  const secret = process.env.RECAPTCHA_SECRET_KEY;
  if (!secret) {
    console.warn('[contact] RECAPTCHA_SECRET_KEY not set');
    return { success: false };
  }
  const res = await fetch('https://www.google.com/recaptcha/api/siteverify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ secret, response: token }),
  });
  const data = (await res.json()) as { success?: boolean; score?: number; 'error-codes'?: string[] };
  if (!data.success) return { success: false };
  // v2 checkbox: no score; v3: check score
  const score = data.score;
  if (score !== undefined && score < RECAPTCHA_MIN_SCORE) return { success: false };
  return { success: true };
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { email, name, subject, message, captchaToken } = body;
    if (!email || !name || !subject || !message) {
      return NextResponse.json(
        { error: 'Email, name, subject and message are required' },
        { status: 400 }
      );
    }
    const secret = process.env.RECAPTCHA_SECRET_KEY;
    if (secret) {
      if (!captchaToken || typeof captchaToken !== 'string') {
        return NextResponse.json(
          { error: 'Security check failed. Please refresh and try again.' },
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
    const result = await sendContactFormEmail(
      String(email).trim(),
      String(name).trim(),
      String(subject).trim(),
      String(message).trim()
    );
    if (!result.ok) {
      return NextResponse.json({ error: 'Failed to send message' }, { status: 500 });
    }
    return NextResponse.json({ success: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Failed to send' }, { status: 500 });
  }
}
