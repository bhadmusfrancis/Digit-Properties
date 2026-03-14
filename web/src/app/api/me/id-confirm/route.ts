import { NextResponse } from 'next/server';
import { getSession } from '@/lib/get-session';
import { dbConnect } from '@/lib/db';
import { uploadIdImage } from '@/lib/upload-id-image';
import { findExistingVerifiedIdentity } from '@/lib/identity-dedup';
import User from '@/models/User';
import { ID_TYPES, type IdType } from '@/lib/constants';

const VALID_ID_TYPES = new Set(Object.values(ID_TYPES));

/** Upload ID images to Cloudinary and mark ID step complete. Saves documents only when user confirms. Requires front + back and ID type; rejects expired IDs. */
export async function POST(req: Request) {
  try {
    const session = await getSession(req);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const formData = await req.formData();
    const idFront = formData.get('idFront') as File | null;
    const idBack = formData.get('idBack') as File | null;
    const idType = typeof formData.get('idType') === 'string' ? String(formData.get('idType')).trim() : '';
    const expiryDateStr = typeof formData.get('expiryDate') === 'string' ? String(formData.get('expiryDate')).trim() : '';

    if (!idFront || !(idFront instanceof File) || idFront.size === 0) {
      return NextResponse.json({ error: 'ID front image (file) is required.' }, { status: 400 });
    }
    if (!idBack || !(idBack instanceof File) || idBack.size === 0) {
      return NextResponse.json({ error: 'ID back image (file) is required. Please scan both front and back of your ID.' }, { status: 400 });
    }
    if (!idType || !VALID_ID_TYPES.has(idType as IdType)) {
      return NextResponse.json({ error: 'Please select the type of ID (Driver\'s License, National ID card, Voters Card, or International passport).' }, { status: 400 });
    }
    if (expiryDateStr) {
      const expiryDate = new Date(expiryDateStr);
      if (!Number.isNaN(expiryDate.getTime()) && expiryDate < new Date()) {
        return NextResponse.json({ error: 'This ID has expired. Please use a valid, unexpired ID.' }, { status: 400 });
      }
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
    userDoc.idBackUrl = idBackUrl ?? undefined;
    userDoc.idType = idType as 'drivers_license' | 'national_id' | 'voters_card' | 'international_passport';
    userDoc.identityVerifiedAt = new Date();
    await userDoc.save();
    return NextResponse.json({ ok: true, message: 'ID verified. You can proceed to Liveness.' });
  } catch (e) {
    console.error('[id-confirm]', e);
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Failed' }, { status: 500 });
  }
}
