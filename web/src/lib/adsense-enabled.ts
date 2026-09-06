import { dbConnect } from '@/lib/db';
import { hasUsableMongoUri } from '@/lib/mongo-uri';
import AdConfig from '@/models/AdConfig';

/** AdSense is on unless an admin has explicitly turned it off. */
export async function getAdsenseEnabled(): Promise<boolean> {
  if (!hasUsableMongoUri()) return true;
  try {
    await dbConnect();
    const config = await AdConfig.findOne().select('adsenseEnabled').lean();
    return config?.adsenseEnabled !== false;
  } catch (e) {
    console.error('[adsense] failed to read enabled flag:', e);
    return true;
  }
}
