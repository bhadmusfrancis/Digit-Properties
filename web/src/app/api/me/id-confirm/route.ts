import { NextResponse } from 'next/server';
import { getSession } from '@/lib/get-session';
import { dbConnect } from '@/lib/db';
import { uploadIdImage } from '@/lib/upload-id-image';
import { findExistingVerifiedIdentity } from '@/lib/identity-dedup';
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

    await dbConnect();
    const user = await User.findById(session.user.id).select('firstName lastName dateOfBirth idScannedData').lean();
    if (!user) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const firstName = (user.firstName ?? (user.idScannedData as { firstName?: string })?.firstName) ?? '';
    const lastName = (user.lastName ?? (user.idScannedData as { lastName?: string })?.lastName) ?? '';
    const dateOfBirth = user.dateOfBirth ?? (user.idScannedData as { dateOfBirth?: string })?.dateOfBirth;
    const existing = await findExistingVerifiedIdentity(firstName, lastName, dateOfBirth, session.user.id);
    if (existing) {
      return NextResponse.json(
        { error: 'User already exists. An account with this identity (name and date of birth) is already verified.' },
        { status: 400 }
      );
    }

    const idFrontUrl = await uploadIdImage(idFront);
    let idBackUrl: string | null = null;
    if (idBack && idBack instanceof File && idBack.size > 0) {
      idBackUrl = await uploadIdImage(idBack);
    }

    const userDoc = await User.findById(session.user.id);
    if (!userDoc) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    userDoc.idFrontUrl = idFrontUrl;
    if (idBackUrl) userDoc.idBackUrl = idBackUrl;
    userDoc.identityVerifiedAt = new Date();
    await userDoc.save();
    return NextResponse.json({ ok: true, message: 'ID verified. You can proceed to Liveness.' });
  } catch (e) {
    console.error('[id-confirm]', e);
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Failed' }, { status: 500 });
  }
}
