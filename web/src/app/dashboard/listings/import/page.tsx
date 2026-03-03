'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ListingForm } from '@/components/listings/ListingForm';
import type { ParsedListing } from '@/lib/whatsapp-listing-parser';

function parsedToEditInitial(parsed: ParsedListing) {
  return {
    title: parsed.title,
    description: parsed.description,
    listingType: parsed.listingType,
    propertyType: parsed.propertyType,
    price: parsed.price,
    address: parsed.location.address,
    city: parsed.location.city,
    state: parsed.location.state,
    suburb: parsed.location.suburb ?? '',
    bedrooms: parsed.bedrooms,
    bathrooms: parsed.bathrooms,
    toilets: parsed.toilets ?? 0,
    agentName: parsed.agentName ?? '',
    agentPhone: parsed.agentPhone ?? '',
    agentEmail: parsed.agentEmail ?? '',
    rentPeriod: parsed.rentPeriod,
    status: 'draft' as const,
    amenities: Array.isArray(parsed.amenities) ? parsed.amenities.join(', ') : '',
  };
}

export default function ImportFromWhatsAppPage() {
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editInitial, setEditInitial] = useState<ReturnType<typeof parsedToEditInitial> | null>(null);
  const [confidence, setConfidence] = useState<'high' | 'medium' | 'low' | null>(null);
  const [missing, setMissing] = useState<string[]>([]);

  const handleParse = async () => {
    const trimmed = text.trim();
    if (trimmed.length < 10) {
      setError('Paste at least 10 characters from the WhatsApp message.');
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const res = await fetch('/api/listings/parse-from-text', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: trimmed }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Failed to parse');
        setLoading(false);
        return;
      }
      setEditInitial(parsedToEditInitial(data.parsed));
      setConfidence(data.confidence ?? null);
      setMissing(data.missing ?? []);
    } catch {
      setError('Network error. Try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <div className="mb-4 flex items-center gap-2">
        <Link href="/dashboard/listings" className="text-sm font-medium text-gray-600 hover:text-gray-900">
          ← My Properties
        </Link>
      </div>
      <h1 className="text-xl font-bold text-gray-900 sm:text-2xl">Import from WhatsApp</h1>
      <p className="mt-1 text-sm text-gray-600">
        Paste a property message from a WhatsApp group or status. We’ll extract the details and pre-fill the form.
      </p>

      {!editInitial ? (
        <div className="mt-6 space-y-4">
          <label className="block text-sm font-medium text-gray-700">Pasted message</label>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="e.g. 3bed flat for rent in Lekki 500k per year call 08012345678..."
            className="w-full min-h-[140px] rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
            rows={6}
          />
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button
            type="button"
            onClick={handleParse}
            disabled={loading}
            className="btn-primary min-h-[44px] px-4"
          >
            {loading ? 'Parsing…' : 'Parse and pre-fill form'}
          </button>
        </div>
      ) : (
        <div className="mt-6 space-y-4">
          {confidence && (
            <p className="text-sm text-gray-600">
              Confidence: <span className={confidence === 'high' ? 'text-green-600' : confidence === 'medium' ? 'text-amber-600' : 'text-orange-600'}>{confidence}</span>
              {missing.length > 0 && (
                <span className="ml-2"> • Missing: {missing.join(', ')} — please fill below.</span>
              )}
            </p>
          )}
          <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            <ListingForm editInitial={editInitial} />
          </div>
          <button
            type="button"
            onClick={() => { setEditInitial(null); setConfidence(null); setMissing([]); }}
            className="text-sm text-gray-600 hover:text-gray-900"
          >
            ← Parse a different message
          </button>
        </div>
      )}
    </div>
  );
}
