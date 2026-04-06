import { ImageResponse } from 'next/og';
import { OgBrandedFrame, OG_IMAGE_SIZE } from '@/lib/og-image-template';

export const alt = 'Digit Properties — Nigeria real estate';
export const size = OG_IMAGE_SIZE;
export const contentType = 'image/png';

export default function Image() {
  return new ImageResponse(
    (
      <OgBrandedFrame
        title="Buy, sell & rent properties in Nigeria"
        subtitle="Digit Properties — verified listings, alerts, and insights."
      />
    ),
    OG_IMAGE_SIZE,
  );
}
