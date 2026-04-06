import { ImageResponse } from 'next/og';
import mongoose from 'mongoose';
import { dbConnect } from '@/lib/db';
import User from '@/models/User';
import { toFirstName } from '@/lib/display-name';
import { OgBrandedFrame, OG_IMAGE_SIZE } from '@/lib/og-image-template';

export const alt = 'Agent profile';
export const size = OG_IMAGE_SIZE;
export const contentType = 'image/png';

export default async function Image({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return new ImageResponse(
      <OgBrandedFrame title="Agent profile" subtitle="digitproperties.com" kicker="Digit Properties" />,
      OG_IMAGE_SIZE,
    );
  }

  await dbConnect();
  const user = await User.findById(id).select('firstName name role').lean();

  if (!user) {
    return new ImageResponse(
      <OgBrandedFrame title="Agent profile" subtitle="digitproperties.com" kicker="Digit Properties" />,
      OG_IMAGE_SIZE,
    );
  }

  const u = user as { firstName?: string; name?: string; role?: string };
  const name = toFirstName(u.firstName, u.name, 'Agent');
  const role = u.role ? u.role.replace(/_/g, ' ') : '';

  return new ImageResponse(
    <OgBrandedFrame title={name} subtitle={role || 'Property professional on Digit Properties'} kicker="Agent" />,
    OG_IMAGE_SIZE,
  );
}
