'use client';

import { useState, useEffect, useCallback } from 'react';
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
  const total = list.length;

  const goPrev = useCallback(() => {
    setIndex((i) => (i <= 0 ? total - 1 : i - 1));
  }, [total]);
  const goNext = useCallback(() => {
    setIndex((i) => (i >= total - 1 ? 0 : i + 1));
  }, [total]);

  useEffect(() => {
    if (total <= 1) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        goPrev();
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        goNext();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [total, goPrev, goNext]);

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
    <div className="relative aspect-video bg-gray-200" tabIndex={0}>
      <Image
        src={current.url}
        alt={`${title} – image ${index + 1} of ${total}`}
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
      {/* Prev / Next – always show when more than one image */}
      {total > 1 && (
        <>
          <button
            type="button"
            onClick={goPrev}
            className="absolute left-3 top-1/2 z-10 -translate-y-1/2 rounded-full bg-black/60 p-3 text-white shadow hover:bg-black/80 focus:outline-none focus:ring-2 focus:ring-white/50"
            aria-label="Previous image"
          >
            <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <button
            type="button"
            onClick={goNext}
            className="absolute right-3 top-1/2 z-10 -translate-y-1/2 rounded-full bg-black/60 p-3 text-white shadow hover:bg-black/80 focus:outline-none focus:ring-2 focus:ring-white/50"
            aria-label="Next image"
          >
            <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
          {/* Counter and dots */}
          <div className="absolute bottom-3 left-0 right-0 flex flex-col items-center gap-2">
            <span className="rounded-full bg-black/60 px-3 py-1 text-sm font-medium text-white">
              {index + 1} / {total}
            </span>
            <div className="flex justify-center gap-1.5">
              {list.map((_, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setIndex(i)}
                  className={`h-2.5 w-2.5 rounded-full transition-colors ${i === index ? 'bg-white' : 'bg-white/50 hover:bg-white/70'}`}
                  aria-label={`Go to image ${i + 1}`}
                />
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
