/**
 * Seed default transactional email templates.
 * Run: npm run seed:emails
 */

import { config } from 'dotenv';
import path from 'path';
config({ path: path.resolve(process.cwd(), '.env.local') });

import mongoose from 'mongoose';
import EmailTemplate from '../src/models/EmailTemplate';
import { EMAIL_TEMPLATE_SEEDS } from '../src/lib/email-template-seeds';

async function main() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('MONGODB_URI required in .env.local');
    process.exit(1);
  }
  await mongoose.connect(uri);
  for (const t of EMAIL_TEMPLATE_SEEDS) {
    await EmailTemplate.findOneAndUpdate(
      { key: t.key },
      { subject: t.subject, body: t.body },
      { upsert: true }
    );
    console.log('Seeded:', t.key);
  }
  await mongoose.disconnect();
  console.log(`Done. ${EMAIL_TEMPLATE_SEEDS.length} templates upserted.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
