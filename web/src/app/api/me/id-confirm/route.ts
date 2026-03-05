import { NextResponse } from 'next/server';
import { getSession } from '@/lib/get-session';
import { dbConnect } from '@/lib/db';
import { uploadIdImage } from '@/lib/upload-id-image';
import User from '@/models/User';

/** Upload ID images to Cloudinary and mark ID step complete. Saves documents only when user confirms. */
export async function POST(req: Request) {
  try {
    const session = await getSession(req);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const formData = await req.formData();
    const idFront = formData.get('idFront') as File | null;
    const idBack = formData.get('idBack') as File | null;

    if (!idFront || !(idFront instanceof File) || idFront.size === 0) {
      return NextResponse.json({ error: 'ID front image (file) is required.' }, { status: 400 });
    }

    const idFrontUrl = await uploadIdImage(idFront);
    let idBackUrl: string | null = null;
    if (idBack && idBack instanceof File && idBack.size > 0) {
      idBackUrl = await uploadIdImage(idBack);
    }

    await dbConnect();
    const user = await User.findById(session.user.id);
    if (!user) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    user.idFrontUrl = idFrontUrl;
    if (idBackUrl) user.idBackUrl = idBackUrl;
    user.identityVerifiedAt = new Date();
    await user.save();
    return NextResponse.json({ ok: true, message: 'ID verified. You can proceed to Liveness.' });
  } catch (e) {
    console.error('[id-confirm]', e);
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Failed' }, { status: 500 });
  }
}
