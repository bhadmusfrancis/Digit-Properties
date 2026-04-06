import { ImageResponse } from 'next/og';
import { dbConnect } from '@/lib/db';
import Trend from '@/models/Trend';
import { TREND_STATUS } from '@/lib/constants';
import { OgBrandedFrame, OG_IMAGE_SIZE } from '@/lib/og-image-template';

export const alt = 'Digit Properties Trends';
export const size = OG_IMAGE_SIZE;
export const contentType = 'image/png';

const MAX = 72;

function truncate(s: string, max: number) {
  const t = s.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1)}…`;
}

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const key = slug?.trim();
  if (!key) {
    return new ImageResponse(
      <OgBrandedFrame title="Trends" subtitle="digitproperties.com" kicker="Digit Properties" />,
      OG_IMAGE_SIZE,
    );
  }

  await dbConnect();
  const post = await Trend.findOne({ slug: key, status: TREND_STATUS.PUBLISHED })
    .select('title excerpt')
    .lean();

  if (!post) {
    return new ImageResponse(
      <OgBrandedFrame title="Trends" subtitle="digitproperties.com" kicker="Digit Properties" />,
      OG_IMAGE_SIZE,
    );
  }

  const subtitle =
    post.excerpt && post.excerpt.trim().length > 0
      ? truncate(post.excerpt, 140)
      : truncate(post.title ?? 'Article', 140);

  return new ImageResponse(
    <OgBrandedFrame
      title={truncate(post.title ?? 'Article', MAX)}
      subtitle={subtitle}
      kicker="Digit Properties · Trends"
    />,
    OG_IMAGE_SIZE,
  );
}
