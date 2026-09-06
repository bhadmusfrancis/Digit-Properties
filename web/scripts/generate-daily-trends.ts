/**
 * Generate today's five category trend posts.
 * Usage: npx tsx scripts/generate-daily-trends.ts [--force] [--dry-run]
 */
import { config } from 'dotenv';
import path from 'path';

config({ path: path.resolve(process.cwd(), '.env.local') });

import { dbConnect } from '../src/lib/db';
import { generateDailyTrends } from '../src/lib/trends/generator';

async function main() {
  const force = process.argv.includes('--force');
  const dryRun = process.argv.includes('--dry-run');
  await dbConnect();
  console.log(`Generating daily trends${dryRun ? ' (dry run)' : ''}${force ? ' (force)' : ''}…`);
  const result = await generateDailyTrends({ force, dryRun });
  console.log(
    `batch=${result.batchDate} created=${result.created} skipped=${result.skipped} autoPublish=${result.autoPublish}`
  );
  for (const post of result.posts) {
    console.log(
      `  • [${post.category}] ${post.title} → /trends/${post.slug} (${post.status}${post.imageFromSource ? ', source image' : ''})`
    );
  }
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
