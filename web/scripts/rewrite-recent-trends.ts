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
  const { writeTrendArticle } = await import('../src/lib/trends/writer');
  const { formatTrendArticleHtml, stripInlineImages } = await import('../src/lib/trends/html');
  const { TREND_CATEGORIES } = await import('../src/lib/constants');
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
      });

      const content = stripInlineImages(formatTrendArticleHtml(article.content));
      const title = article.title
        .replace(/\s*[—–-]\s*(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)\b.*$/i, '')
        .trim();
      const excerpt = article.excerpt
        .replace(/\bfor\s+(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)\b[^.]*/gi, '')
        .replace(/\b\d{1,2}\s+\w+\s+\d{4}\b/g, '')
        .replace(/\s{2,}/g, ' ')
        .trim();

      if (dryRun) {
        console.log(`  would update title: ${title}`);
        console.log(`  content preview: ${content.slice(0, 180).replace(/\s+/g, ' ')}…`);
      } else {
        post.title = title.slice(0, 140);
        post.excerpt = (excerpt || article.excerpt).slice(0, 240);
        post.content = content;
        post.sourceUrls = article.sourceUrls;
        if (!post.batchDate) post.batchDate = batchDate;
        await post.save();
        console.log(`  saved: ${post.title}`);
      }

      siblings.push(category);
      siblingByDay.set(day, siblings);
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
