/**
 * Fix repetitive Trends titles/excerpts for yesterday + today.
 * Uses OpenAI rewrite when available; otherwise applies human-tone fallbacks
 * for copy that still uses banned stock phrases (Navigating, Landscape, etc.).
 *
 * Usage (from web/): npx tsx scripts/sanitize-recent-trend-titles.ts [--dry-run]
 */
import { config } from 'dotenv';
import path from 'path';

config({ path: path.resolve(process.cwd(), '.env.local') });

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  const { dbConnect } = await import('../src/lib/db');
  const { default: Trend } = await import('../src/models/Trend');
  const { pickSourcesForCategory } = await import('../src/lib/trends/sources');
  const { formatResearchBrief, researchSources } = await import('../src/lib/trends/research');
  const {
    writeTrendArticle,
    sanitizeTrendCopy,
    TREND_BANNED_TITLE_PHRASES,
  } = await import('../src/lib/trends/writer');
  const { TREND_CATEGORIES } = await import('../src/lib/constants');
  const { revalidateTrendSeoSurfaces } = await import('../src/lib/seo/revalidate-sitemaps');
  type TrendCategory = (typeof TREND_CATEGORIES)[number];

  await dbConnect();

  const toDateOnly = (d: Date) =>
    new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const today = toDateOnly(new Date());
  const yesterday = new Date(today);
  yesterday.setUTCDate(yesterday.getUTCDate() - 1);
  const tomorrow = new Date(today);
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);

  const posts = await Trend.find({
    $or: [
      { batchDate: { $in: [yesterday, today] } },
      { createdAt: { $gte: yesterday, $lt: tomorrow } },
      { publishedAt: { $gte: yesterday, $lt: tomorrow } },
    ],
  }).sort({ batchDate: 1, createdAt: 1 });

  console.log(`Found ${posts.length} post(s). dryRun=${dryRun}`);

  const recentTitles: string[] = [];
  const recentExcerpts: string[] = [];
  let updated = 0;

  const needsFix = (text: string) => {
    const n = text.toLowerCase();
    return TREND_BANNED_TITLE_PHRASES.some((p) => n.includes(p.toLowerCase()));
  };

  for (const post of posts) {
    const category = TREND_CATEGORIES.includes(post.category as TrendCategory)
      ? (post.category as TrendCategory)
      : ('Market Trends' as TrendCategory);
    const batchDate = post.batchDate ? toDateOnly(new Date(post.batchDate)) : today;

    console.log(`\n→ [${category}] ${post.slug}`);
    console.log(`  old: ${post.title}`);

    let title = sanitizeTrendCopy(post.title || '', 140);
    let excerpt = sanitizeTrendCopy(post.excerpt || '', 240);

    const stillBad = needsFix(title) || needsFix(excerpt) || !title || !excerpt;
    if (stillBad) {
      try {
        const sources = pickSourcesForCategory(category, 4);
        const snippets = await researchSources(sources);
        const researchBrief = formatResearchBrief(snippets);
        const article = await writeTrendArticle({
          category,
          snippets,
          researchBrief,
          batchDate,
          siblingCategories: [],
          recentTitles,
          recentExcerpts,
        });
        title = sanitizeTrendCopy(article.title, 140);
        excerpt = sanitizeTrendCopy(article.excerpt, 240);
        // Title/excerpt only here — do not replace body when OpenAI falls back to templates.
        console.log('  refreshed title/excerpt via writer');
      } catch (e) {
        console.warn(`  writer failed: ${(e as Error).message}`);
      }
    } else {
      console.log('  sanitized in place');
    }

    console.log(`  new: ${title}`);
    console.log(`  excerpt: ${excerpt}`);

    if (!dryRun) {
      post.title = title;
      post.excerpt = excerpt;
      await post.save();
      try {
        revalidateTrendSeoSurfaces({ slug: post.slug });
      } catch {
        /* scripts outside Next request context cannot revalidatePath */
      }
      updated += 1;
    }

    recentTitles.unshift(title);
    recentExcerpts.unshift(excerpt);
  }

  console.log(`\nDone. ${dryRun ? 'Would update' : 'Updated'} ${updated || posts.length} post(s).`);
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
