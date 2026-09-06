/**
 * Rewrite trend posts from yesterday + today into proper HTML (no date spam, no in-body images).
 * Usage: npx tsx scripts/rewrite-recent-trends.ts [--dry-run]
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
  const { writeTrendArticle, sanitizeTrendCopy } = await import('../src/lib/trends/writer');
  const { formatTrendArticleHtml, stripInlineImages } = await import('../src/lib/trends/html');
  const { TREND_CATEGORIES } = await import('../src/lib/constants');
  const { revalidateTrendSeoSurfaces } = await import('../src/lib/seo/revalidate-sitemaps');
  type TrendCategory = (typeof TREND_CATEGORIES)[number];

  await dbConnect();

  const toDateOnly = (d: Date) =>
    new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const dateKey = (d: Date) => d.toISOString().slice(0, 10);

  const today = toDateOnly(new Date());
  const yesterday = new Date(today);
  yesterday.setUTCDate(yesterday.getUTCDate() - 1);

  const days = [yesterday, today];
  console.log(
    `Rewriting trends for ${days.map(dateKey).join(' + ')}${dryRun ? ' (dry run)' : ''}…`
  );

  const posts = await Trend.find({
    $or: [
      { batchDate: { $in: days } },
      {
        createdAt: {
          $gte: yesterday,
          $lt: new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() + 1)),
        },
      },
    ],
  }).sort({ batchDate: 1, createdAt: 1 });

  console.log(`Found ${posts.length} post(s).`);
  if (posts.length === 0) process.exit(0);

  const recentPosts = await Trend.find({
    createdAt: { $gte: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000) },
  })
    .select('title excerpt')
    .sort({ publishedAt: -1 })
    .limit(40)
    .lean();
  const recentTitles = recentPosts.map((p) => String(p.title || '')).filter(Boolean);
  const recentExcerpts = recentPosts.map((p) => String(p.excerpt || '')).filter(Boolean);

  const rewritten: string[] = [];
  const siblingByDay = new Map<string, string[]>();

  for (const post of posts) {
    const category = TREND_CATEGORIES.includes(post.category as TrendCategory)
      ? (post.category as TrendCategory)
      : ('Market Trends' as TrendCategory);
    const batchDate = post.batchDate ? toDateOnly(new Date(post.batchDate)) : today;
    const day = dateKey(batchDate);
    const siblings = siblingByDay.get(day) ?? [];

    console.log(`\n→ [${category}] ${post.slug}`);
    console.log(`  old title: ${post.title}`);

    try {
      const sources = pickSourcesForCategory(category, 4);
      const snippets = await researchSources(sources);
      const researchBrief = formatResearchBrief(snippets);
      const article = await writeTrendArticle({
        category,
        snippets,
        researchBrief,
        batchDate,
        siblingCategories: siblings,
        recentTitles,
        recentExcerpts,
      });

      const content = stripInlineImages(formatTrendArticleHtml(article.content));
      const title = sanitizeTrendCopy(article.title, 140);
      const excerpt = sanitizeTrendCopy(article.excerpt || '', 240);

      if (dryRun) {
        console.log(`  would update title: ${title}`);
        console.log(`  would update excerpt: ${excerpt}`);
      } else {
        post.title = title;
        post.excerpt = excerpt;
        post.content = content;
        post.sourceUrls = article.sourceUrls;
        if (!post.batchDate) post.batchDate = batchDate;
        await post.save();
        revalidateTrendSeoSurfaces({ slug: post.slug });
        console.log(`  saved: ${post.title}`);
        console.log(`  excerpt: ${post.excerpt}`);
      }

      siblings.push(category);
      siblingByDay.set(day, siblings);
      recentTitles.unshift(title);
      recentExcerpts.unshift(excerpt);
      rewritten.push(post.slug);
    } catch (e) {
      console.error(`  failed: ${(e as Error).message}`);
    }
  }

  console.log(`\nDone. ${dryRun ? 'Would rewrite' : 'Rewrote'} ${rewritten.length}/${posts.length} post(s).`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
