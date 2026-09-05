import { dbConnect } from '@/lib/db';
import AdConfig from '@/models/AdConfig';

/** AdSense is on unless an admin has explicitly turned it off. */
export async function getAdsenseEnabled(): Promise<boolean> {
  try {
    await dbConnect();
    const config = await AdConfig.findOne().select('adsenseEnabled').lean();
    return config?.adsenseEnabled !== false;
  } catch (e) {
    console.error('[adsense] failed to read enabled flag:', e);
    return true;
  }
}
