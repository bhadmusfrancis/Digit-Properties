/**
 * Regenerate hero images for yesterday + today Trends posts using the
 * copyright-safe pipeline (OG/news images → thematic cues → original AI hero).
 *
 * Usage (from web/): npx tsx scripts/regenerate-recent-trend-images.ts [--dry-run]
 */
import { config } from 'dotenv';
import path from 'path';

config({ path: path.resolve(process.cwd(), '.env.local') });

async function main() {
  const dryRun = process.argv.includes('--dry-run');

  const { dbConnect } = await import('../src/lib/db');
  const { default: Trend } = await import('../src/models/Trend');
  const { pickSourcesForCategory, TREND_SOURCES } = await import('../src/lib/trends/sources');
  type TrendSource = import('../src/lib/trends/sources').TrendSource;
  const { researchSources } = await import('../src/lib/trends/research');
  const { resolveTrendImage } = await import('../src/lib/trends/images');
  const { TREND_CATEGORIES } = await import('../src/lib/constants');
  type TrendCategory = (typeof TREND_CATEGORIES)[number];

  function sourceFromUrl(url: string, category: TrendCategory, index: number): TrendSource {
    const known = TREND_SOURCES.find((s) => {
      try {
        return new URL(s.url).hostname.replace(/^www\./i, '') === new URL(url).hostname.replace(/^www\./i, '');
      } catch {
        return s.url === url;
      }
    });
    if (known) return { ...known, url };
    return {
      name: `Source ${index + 1}`,
      url,
      kind: 'website',
      categories: [category],
    };
  }

  await dbConnect();

  const toDateOnly = (d: Date) =>
    new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const dateKey = (d: Date) => d.toISOString().slice(0, 10);

  const today = toDateOnly(new Date());
  const yesterday = new Date(today);
  yesterday.setUTCDate(yesterday.getUTCDate() - 1);
  const tomorrow = new Date(today);
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);

  const days = [yesterday, today];
  console.log(
    `Regenerating trend images for ${days.map(dateKey).join(' + ')}${dryRun ? ' (dry run)' : ''}…`
  );

  const posts = await Trend.find({
    $or: [
      { batchDate: { $in: days } },
      {
        createdAt: {
          $gte: yesterday,
          $lt: tomorrow,
        },
      },
      {
        publishedAt: {
          $gte: yesterday,
          $lt: tomorrow,
        },
      },
    ],
  }).sort({ batchDate: 1, createdAt: 1 });

  console.log(`Found ${posts.length} post(s).`);
  if (posts.length === 0) process.exit(0);

  let updated = 0;
  let failed = 0;

  for (const post of posts) {
    const category = TREND_CATEGORIES.includes(post.category as TrendCategory)
      ? (post.category as TrendCategory)
      : ('Market Trends' as TrendCategory);

    console.log(`\n→ [${category}] ${post.slug}`);
    console.log(`  current: ${post.imageLicense || 'no-license'} · ${post.imageUrl?.slice(0, 70) || 'none'}…`);

    try {
      let sources: TrendSource[];
      if (Array.isArray(post.sourceUrls) && post.sourceUrls.length > 0) {
        sources = post.sourceUrls.map((url, i) => sourceFromUrl(url, category, i));
      } else {
        sources = pickSourcesForCategory(category, 4);
      }

      const snippets = await researchSources(sources);
      const withOg = snippets.filter((s) => s.imageUrl).length;
      console.log(`  research: ${snippets.filter((s) => s.ok).length}/${snippets.length} ok, ${withOg} with OG image`);

      const image = await resolveTrendImage({
        title: post.title,
        excerpt: post.excerpt || '',
        category,
        snippets,
      });

      if (!image.imageUrl) {
        console.warn('  skipped: no image resolved');
        failed += 1;
        continue;
      }

      console.log(
        `  new: ${image.imageLicense}${image.fromSource ? ' (major/public source)' : ''} · ${image.imageCredit} · ${image.imageUrl.slice(0, 70)}…`
      );

      if (dryRun) {
        updated += 1;
        continue;
      }

      post.imageUrl = image.imageUrl;
      post.imageCredit = image.imageCredit;
      post.imageSourceName = image.imageSourceName;
      post.imageSourceUrl = image.imageSourceUrl;
      post.imageLicense = image.imageLicense;
      await post.save();
      updated += 1;
      console.log('  saved');
    } catch (e) {
      failed += 1;
      console.error(`  failed: ${(e as Error).message}`);
    }
  }

  console.log(`\nDone. ${dryRun ? 'Would update' : 'Updated'} ${updated}/${posts.length}; failed ${failed}.`);
  process.exit(failed > 0 && updated === 0 ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
