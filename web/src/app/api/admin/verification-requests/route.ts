import { NextResponse } from 'next/server';
import { getSession } from '@/lib/get-session';
import { dbConnect } from '@/lib/db';
import VerificationRequest from '@/models/VerificationRequest';
import { USER_ROLES } from '@/lib/constants';

/** GET /api/admin/verification-requests — list pending (and recent) verification requests */
export async function GET(req: Request) {
  try {
    const session = await getSession(req);
    if (!session?.user?.id || session.user.role !== USER_ROLES.ADMIN) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status');
    await dbConnect();
    const filter: Record<string, string> = {};
    if (status === 'pending' || status === 'approved' || status === 'rejected') {
      filter.status = status;
    }
    const list = await VerificationRequest.find(filter)
      .populate('userId', 'name email phone role companyPosition idFrontUrl idBackUrl livenessCentreImageUrl')
      .populate('reviewedBy', 'name')
      .sort({ createdAt: -1 })
      .limit(100)
      .lean();
    return NextResponse.json(list);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Failed to fetch requests' }, { status: 500 });
  }
}
