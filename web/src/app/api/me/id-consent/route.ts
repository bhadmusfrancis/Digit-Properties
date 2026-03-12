import { NextResponse } from 'next/server';
import { getSession } from '@/lib/get-session';
import { dbConnect } from '@/lib/db';
import { uploadIdImage } from '@/lib/upload-id-image';
import { findExistingVerifiedIdentity } from '@/lib/identity-dedup';
import User from '@/models/User';
import type { IIdScannedData } from '@/models/User';
import { ID_TYPES } from '@/lib/constants';

const VALID_ID_TYPES = new Set(Object.values(ID_TYPES));

/** Upload ID images to Cloudinary, save scanned data to user, and set identityVerifiedAt. Requires front + back and ID type; rejects expired IDs. */
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
    const firstName = typeof formData.get('firstName') === 'string' ? String(formData.get('firstName')).trim() : '';
    const middleName = typeof formData.get('middleName') === 'string' ? String(formData.get('middleName')).trim() : '';
    const lastName = typeof formData.get('lastName') === 'string' ? String(formData.get('lastName')).trim() : '';
    const dateOfBirth = typeof formData.get('dateOfBirth') === 'string' ? String(formData.get('dateOfBirth')).trim() : '';

    if (!idFront || !(idFront instanceof File) || idFront.size === 0) {
      return NextResponse.json({ error: 'ID front image (file) is required.' }, { status: 400 });
    }
    if (!idBack || !(idBack instanceof File) || idBack.size === 0) {
      return NextResponse.json({ error: 'ID back image (file) is required. Please scan both front and back of your ID.' }, { status: 400 });
    }
    if (!idType || !VALID_ID_TYPES.has(idType)) {
      return NextResponse.json({ error: 'Please select the type of ID (Driver\'s License, National ID card, Voters Card, or International passport).' }, { status: 400 });
    }
    if (expiryDateStr) {
      const expiryDate = new Date(expiryDateStr);
      if (!Number.isNaN(expiryDate.getTime()) && expiryDate < new Date()) {
        return NextResponse.json({ error: 'This ID has expired. Please use a valid, unexpired ID.' }, { status: 400 });
      }
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
    const idBackUrl = await uploadIdImage(idBack);

    const idScannedData: IIdScannedData = {};
    if (firstName) idScannedData.firstName = firstName;
    if (middleName) idScannedData.middleName = middleName;
    if (lastName) idScannedData.lastName = lastName;
    if (dateOfBirth) idScannedData.dateOfBirth = dateOfBirth;

    await dbConnect();
    const user = await User.findById(session.user.id);
    if (!user) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    user.idFrontUrl = idFrontUrl;
    user.idBackUrl = idBackUrl;
    user.idType = idType as 'drivers_license' | 'national_id' | 'voters_card' | 'international_passport';
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
