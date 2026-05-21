/**
 * Remove listings created by import-chat-listings.ts (tag: whatsapp-chat-import).
 * Optionally restrict to one author email for safety.
 *
 *   npx tsx scripts/delete-chat-import-listings.ts
 *   npx tsx scripts/delete-chat-import-listings.ts --dry-run
 *   npx tsx scripts/delete-chat-import-listings.ts --email fabhainternation@gmail.com
 */

import { existsSync } from 'fs';
import path from 'path';

const TAG = 'whatsapp-chat-import';
const DEFAULT_EMAIL = 'fabhainternation@gmail.com';

function parseArgs() {
  const argv = process.argv.slice(2);
  let dryRun = false;
  let email: string | null = DEFAULT_EMAIL;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--dry-run') dryRun = true;
    else if (argv[i] === '--all-authors') email = null;
    else if (argv[i] === '--email' && argv[i + 1]) email = argv[++i];
  }
  return { dryRun, email };
}

async function main() {
  const { config } = await import('dotenv');
  const envPath = path.resolve(process.cwd(), '.env.local');
  if (existsSync(envPath)) config({ path: envPath });

  const mongoose = (await import('mongoose')).default;
  const Listing = (await import('../src/models/Listing')).default;
  const User = (await import('../src/models/User')).default;

  const { dryRun, email } = parseArgs();

  if (!process.env.MONGODB_URI) {
    console.error('MONGODB_URI missing');
    process.exit(1);
  }

  await mongoose.connect(process.env.MONGODB_URI);

  const filter: Record<string, unknown> = { tags: TAG };
  if (email) {
    const user = await User.findOne({ email: email.toLowerCase().trim() }).lean();
    if (!user) {
      console.error(`User not found: ${email}`);
      await mongoose.disconnect();
      process.exit(1);
    }
    filter.createdBy = user._id;
    console.log(`Scope: tag "${TAG}" + createdBy ${email}`);
  } else {
    console.log(`Scope: tag "${TAG}" (all authors) — use --email to narrow`);
  }

  const count = await Listing.countDocuments(filter);
  console.log(`Matching listings: ${count}`);

  if (dryRun) {
    console.log('DRY RUN — no deletes');
    await mongoose.disconnect();
    return;
  }

  const res = await Listing.deleteMany(filter);
  console.log(`Deleted: ${res.deletedCount}`);
  await mongoose.disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
