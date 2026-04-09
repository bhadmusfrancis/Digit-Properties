import { NextResponse } from 'next/server';
import { getSession } from '@/lib/get-session';
import { dbConnect } from '@/lib/db';
import ListingModerationConfig from '@/models/ListingModerationConfig';
import { USER_ROLES } from '@/lib/constants';
import { getListingModerationConfig } from '@/lib/listing-moderation-config';

export async function GET(req: Request) {
  try {
    const session = await getSession(req);
    if (!session?.user?.id || session.user.role !== USER_ROLES.ADMIN) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    const config = await getListingModerationConfig();
    return NextResponse.json(config);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Failed to load listing moderation config' }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const session = await getSession(req);
    if (!session?.user?.id || session.user.role !== USER_ROLES.ADMIN) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    const body = await req.json();
    if (
      typeof body?.newListingsRequireApproval !== 'boolean' ||
      typeof body?.editedListingsRequireApproval !== 'boolean'
    ) {
      return NextResponse.json(
        { error: 'Body must include newListingsRequireApproval and editedListingsRequireApproval (booleans).' },
        { status: 400 }
      );
    }
    const newListingsRequireApproval = body.newListingsRequireApproval;
    const editedListingsRequireApproval = body.editedListingsRequireApproval;

    await dbConnect();
    let doc = await ListingModerationConfig.findOne();
    if (!doc) doc = await ListingModerationConfig.create({});
    doc.newListingsRequireApproval = newListingsRequireApproval;
    doc.editedListingsRequireApproval = editedListingsRequireApproval;
    await doc.save();

    return NextResponse.json({
      newListingsRequireApproval: doc.newListingsRequireApproval,
      editedListingsRequireApproval: doc.editedListingsRequireApproval,
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Failed to save listing moderation config' }, { status: 500 });
  }
}
