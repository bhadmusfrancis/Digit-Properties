/* eslint-disable no-console */
/**
 * Bulk-remove listings that appear to contain multiple listings in one post.
 *
 * Usage (PowerShell):
 *   # Dry run (default)
 *   node .\scripts\cleanup-multi-listing-posts.js
 *
 *   # Actually delete (requires explicit confirm)
 *   $env:CONFIRM_DELETE="YES"; node .\scripts\cleanup-multi-listing-posts.js
 */

// Load env vars from .env.local/.env when running as a script (Next.js does this automatically, node does not).
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  require('dotenv').config({ path: '.env.local' });
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  require('dotenv').config({ path: '.env' });
} catch {}

const mongoose = require('mongoose');

const MONGODB_URI = process.env.MONGODB_URI;
if (!MONGODB_URI) {
  console.error('MONGODB_URI is required in environment.');
  process.exit(1);
}

const CONFIRM_DELETE = String(process.env.CONFIRM_DELETE || '').toUpperCase() === 'YES';

function buildMultiListingQuery() {
  // Heuristics: look for numbering patterns common in WhatsApp "multiple listings" posts.
  // Keep regexes relatively strict to avoid false positives.
  const hasParenNumbered = /\(\s*1\s*\)[\s\S]{0,4000}\(\s*2\s*\)/i;
  const hasLineNumbered = /(^|\n)\s*1[\)\.:-][\s\S]{0,4000}(\n\s*2[\)\.:-])/i;
  const hasBulletNumbered = /(^|\n)\s*(?:\*|-|•)\s*1[\)\.:-][\s\S]{0,4000}(\n\s*(?:\*|-|•)\s*2[\)\.:-])/i;
  const hasManyListingsWord = /(multiple\s+listings|listings?\s*:\s*1[\s\S]{0,1000}2)/i;

  return {
    $or: [
      { description: hasParenNumbered },
      { description: hasLineNumbered },
      { description: hasBulletNumbered },
      { title: hasParenNumbered },
      { title: hasLineNumbered },
      { title: hasBulletNumbered },
      { description: hasManyListingsWord },
      { title: hasManyListingsWord },
    ],
  };
}

async function main() {
  await mongoose.connect(MONGODB_URI);
  const col = mongoose.connection.collection('listings');

  const query = buildMultiListingQuery();
  const total = await col.countDocuments(query);
  console.log(`Matched ${total} listing(s) that look like multi-listing posts.`);

  const sample = await col
    .find(query, { projection: { title: 1, status: 1, createdAt: 1 } })
    .sort({ createdAt: -1 })
    .limit(25)
    .toArray();

  if (sample.length) {
    console.log('Sample (up to 25):');
    for (const d of sample) {
      console.log(`- ${String(d._id)} | ${(d.title || '').slice(0, 90)} | ${d.status || ''}`);
    }
  }

  if (!CONFIRM_DELETE) {
    console.log('\nDry run only. To delete, set CONFIRM_DELETE=YES and rerun.');
    return;
  }

  const res = await col.deleteMany(query);
  console.log(`\nDeleted ${res.deletedCount} listing(s).`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    try {
      await mongoose.disconnect();
    } catch {}
  });

