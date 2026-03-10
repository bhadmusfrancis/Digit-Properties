import { NextResponse } from 'next/server';
import { getSession } from '@/lib/get-session';
import { dbConnect } from '@/lib/db';
import { uploadIdImage } from '@/lib/upload-id-image';
import { findExistingVerifiedIdentity } from '@/lib/identity-dedup';
import User from '@/models/User';
import type { IIdScannedData } from '@/models/User';

/** Upload ID images to Cloudinary, save scanned data to user, and set identityVerifiedAt. */
export async function POST(req: Request) {
  try {
    const session = await getSession(req);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const formData = await req.formData();
    const idFront = formData.get('idFront') as File | null;
    const idBack = formData.get('idBack') as File | null;
    const firstName = typeof formData.get('firstName') === 'string' ? String(formData.get('firstName')).trim() : '';
    const middleName = typeof formData.get('middleName') === 'string' ? String(formData.get('middleName')).trim() : '';
    const lastName = typeof formData.get('lastName') === 'string' ? String(formData.get('lastName')).trim() : '';
    const dateOfBirth = typeof formData.get('dateOfBirth') === 'string' ? String(formData.get('dateOfBirth')).trim() : '';

    if (!idFront || !(idFront instanceof File) || idFront.size === 0) {
      return NextResponse.json({ error: 'ID front image (file) is required.' }, { status: 400 });
    }
    if (!firstName && !lastName && !dateOfBirth) {
      return NextResponse.json({ error: 'Provide at least one of firstName, lastName, dateOfBirth.' }, { status: 400 });
    }

    if (firstName && lastName && dateOfBirth) {
      await dbConnect();
      const existing = await findExistingVerifiedIdentity(firstName, lastName, dateOfBirth, session.user.id);
      if (existing) {
        return NextResponse.json(
          { error: 'User already exists. An account with this identity (name and date of birth) is already verified.' },
          { status: 400 }
        );
      }
    }

    const idFrontUrl = await uploadIdImage(idFront);
    let idBackUrl: string | null = null;
    if (idBack && idBack instanceof File && idBack.size > 0) {
      idBackUrl = await uploadIdImage(idBack);
    }

    const idScannedData: IIdScannedData = {};
    if (firstName) idScannedData.firstName = firstName;
    if (middleName) idScannedData.middleName = middleName;
    if (lastName) idScannedData.lastName = lastName;
    if (dateOfBirth) idScannedData.dateOfBirth = dateOfBirth;

    await dbConnect();
    const user = await User.findById(session.user.id);
    if (!user) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    user.idFrontUrl = idFrontUrl;
    if (idBackUrl) user.idBackUrl = idBackUrl;
    user.idScannedData = idScannedData;
    if (firstName) user.firstName = firstName;
    if (middleName) user.middleName = middleName;
    if (lastName) user.lastName = lastName;
    if (dateOfBirth) {
      const dobDate = new Date(dateOfBirth);
      if (!Number.isNaN(dobDate.getTime())) user.dateOfBirth = dobDate;
    }
    user.identityVerifiedAt = new Date();
    await user.save();
    return NextResponse.json({ ok: true, message: 'Saved. You can proceed to Liveness.' });
  } catch (e) {
    console.error('[id-consent]', e);
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Failed' }, { status: 500 });
  }
}
