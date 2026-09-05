import Trend from '@/models/Trend';
import { TREND_CATEGORIES, TREND_STATUS } from '@/lib/constants';
import { DAILY_TREND_COUNT, type TrendCategory } from '@/lib/trends/sources';

function shuffle<T>(arr: T[]): T[] {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** Pick categories that have not appeared in the last 24h of published posts, then fill randomly. */
export async function pickDailyCategories(
  count = DAILY_TREND_COUNT,
  exclude: TrendCategory[] = []
): Promise<TrendCategory[]> {
  const since = new Date(Date.now() - 36 * 60 * 60 * 1000);
  const recent = await Trend.find({
    status: TREND_STATUS.PUBLISHED,
    publishedAt: { $gte: since },
  })
    .select('category')
    .lean();

  const used = new Set<string>([...exclude, ...recent.map((r) => r.category)]);
  const unused = TREND_CATEGORIES.filter((c) => !used.has(c));
  const usedPool = TREND_CATEGORIES.filter((c) => used.has(c) && !exclude.includes(c));

  const picked: TrendCategory[] = [];
  for (const c of shuffle(unused)) {
    if (picked.length >= count) break;
    picked.push(c);
  }
  for (const c of shuffle(usedPool)) {
    if (picked.length >= count) break;
    picked.push(c);
  }
  return picked;
}
