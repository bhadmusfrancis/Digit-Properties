/**
 * Seed default transactional email templates.
 * Run: npx tsx scripts/seed-email-templates.ts
 */

import { config } from 'dotenv';
import path from 'path';
config({ path: path.resolve(process.cwd(), '.env.local') });

import mongoose from 'mongoose';
import EmailTemplate from '../src/models/EmailTemplate';

const TEMPLATES = [
  {
    key: 'welcome',
    subject: 'Welcome to {{appName}}',
    body: `<p>Hi {{name}},</p>
<p>Welcome to {{appName}}! Your account has been created.</p>
<p>You can now browse properties, save alerts, claim listings, and more.</p>
<p><a href="{{appUrl}}" style="color: #0d9488; text-decoration: underline;">Go to {{appName}}</a></p>`,
  },
  {
    key: 'new_user_admin',
    subject: '[{{appName}}] New user: {{name}}',
    body: `<p>A new user has registered:</p>
<ul>
  <li><strong>Name:</strong> {{name}}</li>
  <li><strong>Email:</strong> {{email}}</li>
</ul>
<p><a href="{{appUrl}}/admin" style="color: #0d9488;">View in admin</a></p>`,
  },
  {
    key: 'new_listing_admin',
    subject: '[{{appName}}] New listing: {{listingTitle}}',
    body: `<p>A new listing has been published:</p>
<ul>
  <li><strong>Title:</strong> {{listingTitle}}</li>
  <li><strong>Type:</strong> {{listingType}}</li>
  <li><strong>Price:</strong> {{price}}</li>
  <li><strong>By:</strong> {{createdByName}}</li>
</ul>
<p><a href="{{appUrl}}/listings/{{listingId}}" style="color: #0d9488;">View listing</a></p>`,
  },
  {
    key: 'new_claim_admin',
    subject: '[{{appName}}] New claim: {{listingTitle}}',
    body: `<p>A new listing claim has been submitted:</p>
<ul>
  <li><strong>Listing:</strong> {{listingTitle}}</li>
  <li><strong>Claimant:</strong> {{claimantName}} ({{claimantEmail}})</li>
</ul>
<p><a href="{{appUrl}}/dashboard/claims" style="color: #0d9488;">Review claim</a></p>`,
  },
  {
    key: 'contact_form',
    subject: '[{{appName}} Contact] {{subject}}',
    body: `<p><strong>From:</strong> {{fromName}} &lt;{{fromEmail}}&gt;</p>
<p><strong>Subject:</strong> {{subject}}</p>
<hr />
<p>{{message}}</p>`,
  },
  {
    key: 'claim_approved',
    subject: '[{{appName}}] Claim approved: {{listingTitle}}',
    body: `<p>Good news! Your claim for <strong>{{listingTitle}}</strong> has been approved.</p>
<p>You now own this listing and can manage it from your dashboard.</p>
<p><a href="{{appUrl}}/listings/{{listingId}}" style="color: #0d9488;">View listing</a></p>`,
  },
  {
    key: 'email_verification',
    subject: 'Verify your email – {{appName}}',
    body: `<p>Hi {{name}},</p>
<p>Please verify your email address to activate your {{appName}} account.</p>
<p><a href="{{verifyUrl}}" style="color: #0d9488; font-weight: 600; text-decoration: underline;">Verify my email</a></p>
<p>This link expires in 24 hours. If you didn't create an account, you can ignore this email.</p>`,
  },
  {
    key: 'password_reset',
    subject: 'Reset your password – {{appName}}',
    body: `<p>Hi {{name}},</p>
<p>You requested a password reset. Click the link below to set a new password.</p>
<p><a href="{{resetUrl}}" style="color: #0d9488; font-weight: 600; text-decoration: underline;">Reset my password</a></p>
<p>This link expires in 1 hour. If you didn't request this, you can ignore this email.</p>`,
  },
  {
    key: 'claim_rejected',
    subject: '[{{appName}}] Claim update: {{listingTitle}}',
    body: `<p>Your claim for <strong>{{listingTitle}}</strong> was not approved.</p>
<p>{{reason}}</p>
<p>If you have questions, please contact us.</p>
<p><a href="{{appUrl}}" style="color: #0d9488;">Browse listings</a></p>`,
  },
];

async function main() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('MONGODB_URI required');
    process.exit(1);
  }
  await mongoose.connect(uri);
  for (const t of TEMPLATES) {
    await EmailTemplate.findOneAndUpdate(
      { key: t.key },
      { subject: t.subject, body: t.body },
      { upsert: true }
    );
    console.log('Seeded:', t.key);
  }
  await mongoose.disconnect();
  console.log('Done.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
