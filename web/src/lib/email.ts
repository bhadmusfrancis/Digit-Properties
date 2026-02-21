import { Resend } from 'resend';

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'contact@digitproperties.com';
const FROM_EMAIL = process.env.FROM_EMAIL || 'Digit Properties <noreply@digitproperties.com>';
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://digitproperties.com';
const APP_NAME = 'Digit Properties';

function canSend(): boolean {
  return !!resend;
}

/** Send email via Resend. No-op if RESEND_API_KEY is not set. */
async function sendEmail(options: {
  to: string | string[];
  subject: string;
  html: string;
  from?: string;
}) {
  if (!resend) {
    console.warn('[email] RESEND_API_KEY not set, skipping send:', options.subject);
    return { ok: true, id: null };
  }
  try {
    const { data, error } = await resend.emails.send({
      from: options.from || FROM_EMAIL,
      to: Array.isArray(options.to) ? options.to : [options.to],
      subject: options.subject,
      html: options.html,
    });
    if (error) {
      console.error('[email] Resend error:', error);
      return { ok: false, error };
    }
    return { ok: true, id: data?.id };
  } catch (e) {
    console.error('[email] Send failed:', e);
    return { ok: false, error: e };
  }
}

// ---- Templates ----

function wrapBody(title: string, body: string): string {
  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head>
<body style="font-family: system-ui, -apple-system, sans-serif; max-width: 560px; margin: 0 auto; padding: 24px; color: #1f2937;">
  <h1 style="color: #0d9488; font-size: 1.5rem;">${APP_NAME}</h1>
  <h2 style="font-size: 1.125rem; margin-top: 24px;">${title}</h2>
  <div style="margin-top: 16px; line-height: 1.6;">${body}</div>
  <p style="margin-top: 32px; font-size: 0.875rem; color: #6b7280;">
    &mdash; ${APP_NAME} Team<br />
    <a href="${APP_URL}" style="color: #0d9488;">${APP_URL}</a>
  </p>
</body>
</html>`;
}

export async function sendWelcomeEmail(to: string, name: string): Promise<{ ok: boolean }> {
  const body = `
    <p>Hi ${name || 'there'},</p>
    <p>Welcome to ${APP_NAME}! Your account has been created.</p>
    <p>You can now browse properties, save alerts, claim listings, and more.</p>
    <p><a href="${APP_URL}" style="color: #0d9488; text-decoration: underline;">Go to ${APP_NAME}</a></p>`;
  const result = await sendEmail({
    to,
    subject: `Welcome to ${APP_NAME}`,
    html: wrapBody('Welcome!', body),
  });
  return { ok: result.ok };
}

export async function sendAdminNewUser(name: string, email: string): Promise<{ ok: boolean }> {
  const body = `
    <p>A new user has registered:</p>
    <ul>
      <li><strong>Name:</strong> ${name}</li>
      <li><strong>Email:</strong> ${email}</li>
    </ul>
    <p><a href="${APP_URL}/admin" style="color: #0d9488;">View in admin</a></p>`;
  const result = await sendEmail({
    to: ADMIN_EMAIL,
    subject: `[${APP_NAME}] New user: ${name}`,
    html: wrapBody('New User Registration', body),
  });
  return { ok: result.ok };
}

export async function sendAdminNewClaim(
  listingTitle: string,
  claimantName: string,
  claimantEmail: string,
  claimId: string
): Promise<{ ok: boolean }> {
  const reviewUrl = `${APP_URL}/dashboard/claims`;
  const body = `
    <p>A new listing claim has been submitted:</p>
    <ul>
      <li><strong>Listing:</strong> ${listingTitle}</li>
      <li><strong>Claimant:</strong> ${claimantName} (${claimantEmail})</li>
    </ul>
    <p><a href="${reviewUrl}" style="color: #0d9488;">Review claim</a></p>`;
  const result = await sendEmail({
    to: ADMIN_EMAIL,
    subject: `[${APP_NAME}] New claim: ${listingTitle}`,
    html: wrapBody('New Listing Claim', body),
  });
  return { ok: result.ok };
}

export async function sendClaimApproved(
  to: string,
  listingTitle: string,
  listingId: string
): Promise<{ ok: boolean }> {
  const url = `${APP_URL}/listings/${listingId}`;
  const body = `
    <p>Good news! Your claim for <strong>${listingTitle}</strong> has been approved.</p>
    <p>You now own this listing and can manage it from your dashboard.</p>
    <p><a href="${url}" style="color: #0d9488;">View listing</a></p>`;
  const result = await sendEmail({
    to,
    subject: `[${APP_NAME}] Claim approved: ${listingTitle}`,
    html: wrapBody('Claim Approved', body),
  });
  return { ok: result.ok };
}

export async function sendClaimRejected(
  to: string,
  listingTitle: string,
  reason?: string
): Promise<{ ok: boolean }> {
  const body = `
    <p>Your claim for <strong>${listingTitle}</strong> was not approved.</p>
    ${reason ? `<p><strong>Reason:</strong> ${reason}</p>` : ''}
    <p>If you have questions, please contact us at ${ADMIN_EMAIL}.</p>
    <p><a href="${APP_URL}" style="color: #0d9488;">Browse listings</a></p>`;
  const result = await sendEmail({
    to,
    subject: `[${APP_NAME}] Claim update: ${listingTitle}`,
    html: wrapBody('Claim Not Approved', body),
  });
  return { ok: result.ok };
}

export async function sendAdminNewListing(
  listingTitle: string,
  listingId: string,
  createdByName: string,
  listingType: string,
  price: number
): Promise<{ ok: boolean }> {
  const url = `${APP_URL}/listings/${listingId}`;
  const priceStr = new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency: 'NGN',
    maximumFractionDigits: 0,
  }).format(price);
  const body = `
    <p>A new listing has been published:</p>
    <ul>
      <li><strong>Title:</strong> ${listingTitle}</li>
      <li><strong>Type:</strong> ${listingType}</li>
      <li><strong>Price:</strong> ${priceStr}</li>
      <li><strong>By:</strong> ${createdByName}</li>
    </ul>
    <p><a href="${url}" style="color: #0d9488;">View listing</a></p>`;
  const result = await sendEmail({
    to: ADMIN_EMAIL,
    subject: `[${APP_NAME}] New listing: ${listingTitle}`,
    html: wrapBody('New Listing Published', body),
  });
  return { ok: result.ok };
}

export async function sendAlertMatchEmail(
  to: string,
  alertName: string,
  listings: Array<{ _id: string; title: string; price: number; listingType: string; rentPeriod?: string }>,
  baseUrl: string
): Promise<{ ok: boolean }> {
  const items = listings
    .slice(0, 5)
    .map(
      (l) =>
        `<li><a href="${baseUrl}/listings/${l._id}" style="color: #0d9488;">${l.title}</a> &ndash; ${new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: 0 }).format(l.price)}${l.listingType === 'rent' && l.rentPeriod ? ` / ${l.rentPeriod}` : ''}</li>`
    )
    .join('');
  const more = listings.length > 5 ? `<p>...and ${listings.length - 5} more.</p>` : '';
  const body = `
    <p>Your alert <strong>${alertName}</strong> has new matches:</p>
    <ul>${items}</ul>
    ${more}
    <p><a href="${baseUrl}/listings" style="color: #0d9488;">Browse all listings</a></p>`;
  const result = await sendEmail({
    to,
    subject: `[${APP_NAME}] New listings matching "${alertName}"`,
    html: wrapBody('Alert: New Listings', body),
  });
  return { ok: result.ok };
}

export async function sendContactFormEmail(
  fromEmail: string,
  fromName: string,
  subject: string,
  message: string
): Promise<{ ok: boolean }> {
  const body = `
    <p><strong>From:</strong> ${fromName} &lt;${fromEmail}&gt;</p>
    <p><strong>Subject:</strong> ${subject}</p>
    <hr />
    <p>${message.replace(/\n/g, '<br />')}</p>`;
  const result = await sendEmail({
    to: ADMIN_EMAIL,
    subject: `[${APP_NAME} Contact] ${subject}`,
    html: wrapBody('Contact form submission', body),
  });
  return { ok: result.ok };
}

export { canSend, ADMIN_EMAIL, FROM_EMAIL };
