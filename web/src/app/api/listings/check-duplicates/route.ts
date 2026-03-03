/**
 * POST /api/listings/check-duplicates
 * Check parsed listings (e.g. from WhatsApp import) against the current user's
 * existing listings to detect possible duplicates. Returns potential matches per index.
 */
import { NextResponse } from 'next/server';
import { getSession } from '@/lib/get-session';
import { dbConnect } from '@/lib/db';
import Listing from '@/models/Listing';
import mongoose from 'mongoose';

type ListingInput = {
  title?: string;
  price?: number;
  city?: string;
  state?: string;
  agentPhone?: string;
  propertyType?: string;
};

function normalizePhone(phone: string | undefined): string {
  if (!phone || typeof phone !== 'string') return '';
  return phone.replace(/\D/g, '').slice(-10);
}

function normalizeTitle(title: string | undefined): string {
  if (!title || typeof title !== 'string') return '';
  return title.toLowerCase().replace(/\s+/g, ' ').trim().slice(0, 100);
}

export async function POST(req: Request) {
  try {
    const session = await getSession(req);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const listings = Array.isArray(body?.listings) ? body.listings as ListingInput[] : [];
    if (listings.length === 0) {
      return NextResponse.json({ results: [] });
    }

    await dbConnect();
    const userId = new mongoose.Types.ObjectId(session.user.id);

    const results: { index: number; duplicates: { _id: string; title: string }[] }[] = [];

    for (let i = 0; i < listings.length; i++) {
      const row = listings[i];
      const price = typeof row?.price === 'number' ? row.price : 0;
      const city = typeof row?.city === 'string' ? row.city.trim() : '';
      const state = typeof row?.state === 'string' ? row.state.trim() : '';
      const agentPhone = normalizePhone(row?.agentPhone);
      const titleNorm = normalizeTitle(row?.title);

      if (!price && !city && !state && !agentPhone) {
        results.push({ index: i, duplicates: [] });
        continue;
      }

      const match: Record<string, unknown> = { createdBy: userId };
      if (price > 0) match.price = price;
      const orConditions: Record<string, unknown>[] = [];
      if (state) orConditions.push({ 'location.state': new RegExp('^' + state.replace(/\s+/g, '\\s*') + '$', 'i') });
      if (city) orConditions.push({ 'location.city': new RegExp('^' + city.replace(/\s+/g, '\\s*') + '$', 'i') });
      if (agentPhone) orConditions.push({ agentPhone: new RegExp(agentPhone.slice(-10) + '|' + agentPhone) });
      if (orConditions.length > 0) match.$or = orConditions;
      else if (!match.price) {
        results.push({ index: i, duplicates: [] });
        continue;
      }

      const candidates = await Listing.find(match)
        .select('_id title price location agentPhone')
        .limit(15)
        .lean();

      const duplicates: { _id: string; title: string }[] = [];
      for (const doc of candidates) {
        const samePrice = price <= 0 || Number(doc.price) === price;
        const sameState = !state || (doc.location as { state?: string })?.state?.toLowerCase() === state.toLowerCase();
        const sameCity = !city || (doc.location as { city?: string })?.city?.toLowerCase() === city.toLowerCase();
        const samePhone = !agentPhone || normalizePhone((doc as { agentPhone?: string }).agentPhone) === agentPhone;
        const docTitleNorm = normalizeTitle(doc.title);
        const titleOverlap = !titleNorm || !docTitleNorm || docTitleNorm.includes(titleNorm) || titleNorm.includes(docTitleNorm) || docTitleNorm.slice(0, 30) === titleNorm.slice(0, 30);

        const score = (samePrice ? 1 : 0) + (sameState ? 1 : 0) + (sameCity ? 1 : 0) + (samePhone ? 1 : 0) + (titleOverlap ? 1 : 0);
        if (score >= 2) {
          duplicates.push({ _id: String(doc._id), title: doc.title || 'Untitled' });
        }
      }

      results.push({ index: i, duplicates });
    }

    return NextResponse.json({ results });
  } catch (e) {
    console.error('[check-duplicates]', e);
    return NextResponse.json({ error: 'Failed to check duplicates' }, { status: 500 });
  }
}
