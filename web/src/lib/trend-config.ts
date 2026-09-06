import { dbConnect } from '@/lib/db';
import TrendConfig from '@/models/TrendConfig';

export type TrendSettings = {
  autoPublish: boolean;
};

const DEFAULTS: TrendSettings = {
  autoPublish: true,
};

export async function getTrendConfig(): Promise<TrendSettings> {
  await dbConnect();
  const doc = await TrendConfig.findOne().lean();
  if (!doc) return { ...DEFAULTS };
  return {
    autoPublish: typeof doc.autoPublish === 'boolean' ? doc.autoPublish : DEFAULTS.autoPublish,
  };
}
