import Trend from '@/models/Trend';
import { TREND_STATUS } from '@/lib/constants';
import { slugify, uniqueSlug } from '@/lib/slugify';
import { getTrendConfig } from '@/lib/trend-config';
import { DAILY_TREND_COUNT, pickSourcesForCategory, type TrendCategory } from '@/lib/trends/sources';
import { formatResearchBrief, researchSources } from '@/lib/trends/research';
import { pickDailyCategories } from '@/lib/trends/rotation';
import { resolveTrendImage } from '@/lib/trends/images';
import { writeTrendArticle } from '@/lib/trends/writer';

export const TREND_AUTHOR = 'Digit Properties Editorial';

export interface GenerateTrendsResult {
  batchDate: string;
  created: number;
  skipped: number;
  autoPublish: boolean;
  posts: { title: string; slug: string; category: string; imageFromSource: boolean; status: string }[];
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
  const { autoPublish } = await getTrendConfig();
  const publishStatus = autoPublish ? TREND_STATUS.PUBLISHED : TREND_STATUS.DRAFT;

  const existing = await Trend.find({ batchDate })
    .select('title slug category imageUrl status')
    .lean();

  if (existing.length >= count && !opts.force) {
    return {
      batchDate: batchDate.toISOString().slice(0, 10),
      created: 0,
      skipped: existing.length,
      autoPublish,
      posts: existing.map((p) => ({
        title: p.title,
        slug: p.slug,
        category: p.category,
        imageFromSource: false,
        status: p.status,
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
    const article = await writeTrendArticle({
      category,
      snippets,
      researchBrief,
      batchDate,
      siblingCategories,
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
        status: publishStatus,
        publishedAt: autoPublish ? new Date() : undefined,
        batchDate,
        sourceUrls: article.sourceUrls,
      });
    }

    created.push({
      title: article.title,
      slug,
      category,
      imageFromSource: image.fromSource,
      status: publishStatus,
    });
    siblingCategories.push(category);
  }

  return {
    batchDate: batchDate.toISOString().slice(0, 10),
    created: created.length,
    skipped: opts.force ? 0 : existing.length,
    autoPublish,
    posts: created,
  };
}
