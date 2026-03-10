import { NextResponse } from 'next/server';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://digitproperties.com';

/**
 * GET /api/auth/verify-phone?token=xxx
 * Link-based phone verification is disabled. Phone must be verified via SMS/WhatsApp OTP only.
 */
export async function GET() {
  return NextResponse.redirect(`${APP_URL}/dashboard/profile?error=PhoneVerificationLinkDisabled`);
}
