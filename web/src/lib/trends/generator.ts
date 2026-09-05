import Trend from '@/models/Trend';
import { TREND_STATUS } from '@/lib/constants';
import { slugify, uniqueSlug } from '@/lib/slugify';
import { DAILY_TREND_COUNT, pickSourcesForCategory, type TrendCategory } from '@/lib/trends/sources';
import { formatResearchBrief, researchSources } from '@/lib/trends/research';
import { pickDailyCategories } from '@/lib/trends/rotation';
import { firstSourceImage, resolveTrendImage } from '@/lib/trends/images';
import { writeTrendArticle } from '@/lib/trends/writer';

export const TREND_AUTHOR = 'Digit Properties Editorial';

export interface GenerateTrendsResult {
  batchDate: string;
  created: number;
  skipped: number;
  posts: { title: string; slug: string; category: string; imageFromSource: boolean }[];
}

export interface GenerateTrendsOptions {
  batchDate?: Date;
  count?: number;
  force?: boolean;
  dryRun?: boolean;
}

function toDateOnly(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

export async function generateDailyTrends(opts: GenerateTrendsOptions = {}): Promise<GenerateTrendsResult> {
  const batchDate = toDateOnly(opts.batchDate ?? new Date());
  const count = opts.count ?? DAILY_TREND_COUNT;

  const existing = await Trend.find({
    batchDate,
    status: TREND_STATUS.PUBLISHED,
  })
    .select('title slug category imageUrl')
    .lean();

  if (existing.length >= count && !opts.force) {
    return {
      batchDate: batchDate.toISOString().slice(0, 10),
      created: 0,
      skipped: existing.length,
      posts: existing.map((p) => ({
        title: p.title,
        slug: p.slug,
        category: p.category,
        imageFromSource: false,
      })),
    };
  }

  if (opts.force && !opts.dryRun) {
    await Trend.deleteMany({ batchDate });
  }

  const alreadyCategories = opts.force ? [] : (existing.map((p) => p.category) as TrendCategory[]);
  const need = opts.force ? count : Math.max(0, count - existing.length);
  const categories = await pickDailyCategories(need, alreadyCategories);

  const created: GenerateTrendsResult['posts'] = [];
  const siblingCategories = [...alreadyCategories];

  for (const category of categories) {
    const sources = pickSourcesForCategory(category, 4);
    const snippets = await researchSources(sources);
    const researchBrief = formatResearchBrief(snippets);
    const sourceImage = firstSourceImage(snippets);
    const article = await writeTrendArticle({
      category,
      snippets,
      researchBrief,
      batchDate,
      siblingCategories,
      inBodyImage: sourceImage ? { url: sourceImage, caption: `${category} — source imagery` } : undefined,
    });

    const image = await resolveTrendImage({
      title: article.title,
      excerpt: article.excerpt,
      category,
      snippets,
    });

    const baseSlug = slugify(article.title) || slugify(`${category}-${batchDate.toISOString().slice(0, 10)}`);
    const slug = await uniqueSlug(baseSlug, async (candidate) => !(await Trend.findOne({ slug: candidate }).select('_id').lean()));

    if (!opts.dryRun) {
      await Trend.create({
        title: article.title,
        slug,
        excerpt: article.excerpt,
        content: article.content,
        category,
        imageUrl: image.imageUrl,
        author: TREND_AUTHOR,
        status: TREND_STATUS.PUBLISHED,
        publishedAt: new Date(),
        batchDate,
        sourceUrls: article.sourceUrls,
      });
    }

    created.push({
      title: article.title,
      slug,
      category,
      imageFromSource: image.fromSource,
    });
    siblingCategories.push(category);
  }

  return {
    batchDate: batchDate.toISOString().slice(0, 10),
    created: created.length,
    skipped: opts.force ? 0 : existing.length,
    posts: created,
  };
}
