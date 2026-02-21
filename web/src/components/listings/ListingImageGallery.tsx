'use client';

import { useState } from 'react';
import Image from 'next/image';

type ImageItem = { url: string; public_id?: string };

export function ListingImageGallery({
  images,
  title,
  isBoosted,
}: {
  images: ImageItem[];
  title: string;
  isBoosted?: boolean;
}) {
  const [index, setIndex] = useState(0);
  const list = images?.filter((img) => img?.url) ?? [];
  const current = list[index] ?? list[0];

  if (list.length === 0) {
    return (
      <div className="relative aspect-video bg-gray-200">
        <div className="flex h-full items-center justify-center text-gray-400">
          <svg className="h-24 w-24" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
          </svg>
        </div>
        {isBoosted && (
          <span className="absolute left-4 top-4 rounded bg-amber-500 px-3 py-1 text-sm font-medium text-white">
            Sponsored
          </span>
        )}
      </div>
    );
  }

  return (
    <div className="relative aspect-video bg-gray-200">
      <Image
        src={current.url}
        alt={title}
        fill
        className="object-cover"
        priority
        sizes="(max-width: 1024px) 100vw, 66vw"
        unoptimized={!current.url.includes('res.cloudinary.com')}
      />
      {isBoosted && (
        <span className="absolute left-4 top-4 rounded bg-amber-500 px-3 py-1 text-sm font-medium text-white">
          Sponsored
        </span>
      )}
      {list.length > 1 && (
        <>
          <button
            type="button"
            onClick={() => setIndex((i) => (i <= 0 ? list.length - 1 : i - 1))}
            className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-black/50 p-2 text-white hover:bg-black/70"
            aria-label="Previous image"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <button
            type="button"
            onClick={() => setIndex((i) => (i >= list.length - 1 ? 0 : i + 1))}
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-black/50 p-2 text-white hover:bg-black/70"
            aria-label="Next image"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
          <div className="absolute bottom-3 left-0 right-0 flex justify-center gap-1.5">
            {list.map((_, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setIndex(i)}
                className={`h-2 w-2 rounded-full ${i === index ? 'bg-white' : 'bg-white/50'}`}
                aria-label={`Image ${i + 1}`}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
