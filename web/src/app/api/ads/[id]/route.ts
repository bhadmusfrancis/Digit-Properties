import { NextResponse } from 'next/server';
import { getSession } from '@/lib/get-session';
import { dbConnect } from '@/lib/db';
import UserAd from '@/models/UserAd';
import { USER_AD_STATUS } from '@/lib/constants';
import mongoose from 'mongoose';

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession(req);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json({ error: 'Invalid ad ID' }, { status: 400 });
    }

    await dbConnect();
    const ad = await UserAd.findById(id);
    if (!ad) return NextResponse.json({ error: 'Ad not found' }, { status: 404 });
    if (ad.userId.toString() !== session.user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    if (ad.status !== USER_AD_STATUS.PENDING_APPROVAL && ad.status !== USER_AD_STATUS.REJECTED) {
      return NextResponse.json({ error: 'Only pending or rejected ads can be updated' }, { status: 400 });
    }

    const body = await req.json();
    const { media, startDate, endDate, targetUrl } = body as {
      media?: { public_id: string; url: string; type: 'image' | 'video' };
      startDate?: string;
      endDate?: string;
      targetUrl?: string;
    };

    if (media?.url && media?.public_id && ['image', 'video'].includes(media.type || '')) {
      ad.media = { public_id: media.public_id, url: media.url, type: media.type };
    }
    if (startDate) ad.startDate = new Date(startDate);
    if (endDate) ad.endDate = new Date(endDate);
    if (targetUrl != null && typeof targetUrl === 'string' && /^https?:\/\//i.test(targetUrl)) {
      ad.targetUrl = targetUrl.trim();
    }
    if (ad.status === USER_AD_STATUS.REJECTED) {
      ad.status = USER_AD_STATUS.PENDING_APPROVAL;
      ad.rejectionReason = undefined;
    }
    await ad.save();

    return NextResponse.json({
      ad: {
        _id: ad._id.toString(),
        placement: ad.placement,
        media: ad.media,
        startDate: ad.startDate,
        endDate: ad.endDate,
        targetUrl: ad.targetUrl,
        status: ad.status,
      },
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Failed to update ad' }, { status: 500 });
  }
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession(_req);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json({ error: 'Invalid ad ID' }, { status: 400 });
    }

    await dbConnect();
    const ad = await UserAd.findById(id).lean();
    if (!ad) return NextResponse.json({ error: 'Ad not found' }, { status: 404 });
    if ((ad as { userId: mongoose.Types.ObjectId }).userId.toString() !== session.user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const row = ad as { _id: mongoose.Types.ObjectId; userId: mongoose.Types.ObjectId; [k: string]: unknown };
    return NextResponse.json({
      ad: { ...row, _id: row._id.toString(), userId: row.userId?.toString() },
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Failed to fetch ad' }, { status: 500 });
  }
}
