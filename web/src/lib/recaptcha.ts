const RECAPTCHA_MIN_SCORE = 0.5;

export type RecaptchaResult = { success: boolean };

/** Verify reCAPTCHA v2 checkbox or v3 token server-side. */
export async function verifyRecaptcha(token: string): Promise<RecaptchaResult> {
  const secret = process.env.RECAPTCHA_SECRET_KEY;
  if (!secret) {
    console.warn('[recaptcha] RECAPTCHA_SECRET_KEY not set');
    return { success: false };
  }
  const res = await fetch('https://www.google.com/recaptcha/api/siteverify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ secret, response: token }),
  });
  const data = (await res.json()) as { success?: boolean; score?: number; 'error-codes'?: string[] };
  if (!data.success) return { success: false };
  const score = data.score;
  if (score !== undefined && score < RECAPTCHA_MIN_SCORE) return { success: false };
  return { success: true };
}

export function isRecaptchaConfigured(): boolean {
  return !!(process.env.RECAPTCHA_SECRET_KEY && process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY);
}
