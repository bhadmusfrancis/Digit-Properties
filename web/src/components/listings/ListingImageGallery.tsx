'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Image from 'next/image';
import { getCloudinaryVideoThumbnailUrl } from '@/lib/listing-default-image';
import { ListingMarketStatusSticker } from '@/components/listings/ListingMarketStatusSticker';
import { SponsoredLabel } from '@/components/ui/SponsoredLabel';

type MediaItem = { url: string; public_id?: string; type?: 'image' | 'video' };

function galleryMediaAltText(
  title: string,
  locationLabel: string | undefined,
  list: MediaItem[],
  index: number
): string {
  const loc = locationLabel?.trim() ? ` · ${locationLabel.trim()}` : '';
  const cur = list[index];
  if (cur?.type === 'video') {
    return `${title}${loc} · Property video`;
  }
  const stills = list.filter((x) => x.type !== 'video');
  const n = list.slice(0, index + 1).filter((x) => x.type !== 'video').length;
  const denom = Math.max(stills.length, 1);
  return `${title}${loc} · Listing photo ${n} of ${denom}`;
}

const ZOOM_LEVELS = [1, 1.5, 2, 2.5, 3];
const MIN_ZOOM = 1;
const MAX_ZOOM = 3;

function ListingGalleryVideo({
  videoRef,
  src,
  poster,
  className,
  size = 'md',
  objectFit = 'cover',
}: {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  src: string;
  poster?: string;
  className?: string;
  size?: 'md' | 'lg';
  objectFit?: 'cover' | 'contain';
}) {
  const [playing, setPlaying] = useState(false);
  const iconBox = size === 'lg' ? 'h-20 w-20' : 'h-16 w-16';
  const icon = size === 'lg' ? 'h-10 w-10' : 'h-8 w-8';

  useEffect(() => {
    setPlaying(false);
  }, [src]);

  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;
    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    const onEnded = () => setPlaying(false);
    el.addEventListener('play', onPlay);
    el.addEventListener('pause', onPause);
    el.addEventListener('ended', onEnded);
    return () => {
      el.removeEventListener('play', onPlay);
      el.removeEventListener('pause', onPause);
      el.removeEventListener('ended', onEnded);
    };
  }, [videoRef, src]);

  const togglePlay = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      const el = videoRef.current;
      if (!el) return;
      if (el.paused) void el.play().catch(() => setPlaying(false));
      else el.pause();
    },
    [videoRef]
  );

  const objectClass = objectFit === 'contain' ? 'object-contain' : 'object-cover';

  return (
    <div className={`relative h-full w-full ${className ?? ''}`}>
      <video
        ref={videoRef}
        src={src}
        poster={poster}
        preload="metadata"
        playsInline
        className={`h-full w-full ${objectClass}`}
      />
      <button
        type="button"
        onClick={togglePlay}
        className="absolute left-1/2 top-1/2 z-10 flex -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-black/55 text-white shadow-lg transition hover:bg-black/70 focus:outline-none focus:ring-2 focus:ring-white/60"
        aria-label={playing ? 'Pause video' : 'Play video'}
      >
        <span className={`flex items-center justify-center rounded-full ${iconBox}`}>
          {playing ? (
            <svg className={icon} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
              <path d="M6 5h4v14H6V5zm8 0h4v14h-4V5z" />
            </svg>
          ) : (
            <svg className={`${icon} ml-1`} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
              <path d="M8 5v14l11-7z" />
            </svg>
          )}
        </span>
      </button>
    </div>
  );
}

export function ListingImageGallery({
  images,
  title,
  locationLabel,
  isBoosted,
  soldAt,
  rentedAt,
}: {
  images: MediaItem[];
  title: string;
  /** City / state line for descriptive image alt text (Google Images + a11y). */
  locationLabel?: string;
  isBoosted?: boolean;
  soldAt?: string | Date | null;
  rentedAt?: string | Date | null;
}) {
  const [index, setIndex] = useState(0);
  const [fullscreenOpen, setFullscreenOpen] = useState(false);
  const [zoomIndex, setZoomIndex] = useState(0);
  const inlineVideoRef = useRef<HTMLVideoElement>(null);
  const fullscreenVideoRef = useRef<HTMLVideoElement>(null);
  const list = images?.filter((img) => img?.url) ?? [];
  const current = list[index] ?? list[0];
  const total = list.length;
  const zoom = ZOOM_LEVELS[zoomIndex] ?? 1;

  const goPrev = useCallback(() => {
    setIndex((i) => (i <= 0 ? total - 1 : i - 1));
    setZoomIndex(0);
  }, [total]);
  const goNext = useCallback(() => {
    setIndex((i) => (i >= total - 1 ? 0 : i + 1));
    setZoomIndex(0);
  }, [total]);

  const openFullscreen = useCallback(() => setFullscreenOpen(true), []);
  const closeFullscreen = useCallback(() => {
    setFullscreenOpen(false);
    setZoomIndex(0);
  }, []);

  const zoomIn = useCallback(() => {
    setZoomIndex((i) => Math.min(i + 1, ZOOM_LEVELS.length - 1));
  }, []);
  const zoomOut = useCallback(() => {
    setZoomIndex((i) => Math.max(i - 1, 0));
  }, []);

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

  useEffect(() => {
    if (!fullscreenOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        closeFullscreen();
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        goPrev();
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        goNext();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [fullscreenOpen, closeFullscreen, goPrev, goNext]);

  useEffect(() => {
    if (fullscreenOpen) document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, [fullscreenOpen]);

  useEffect(() => {
    inlineVideoRef.current?.pause();
    fullscreenVideoRef.current?.pause();
  }, [index, current?.url]);

  if (list.length === 0) {
    return (
      <div className="relative aspect-video bg-gray-200">
        <div className="flex h-full items-center justify-center text-gray-400">
          <svg className="h-24 w-24" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
          </svg>
        </div>
        {isBoosted && <SponsoredLabel overlay className="absolute left-4 top-4 z-30" />}
        <ListingMarketStatusSticker soldAt={soldAt} rentedAt={rentedAt} variant="gallery" />
      </div>
    );
  }

  const handleFullscreenKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        openFullscreen();
      }
    },
    [openFullscreen]
  );

  return (
    <>
      <div
        role="button"
        tabIndex={0}
        onClick={openFullscreen}
        onKeyDown={handleFullscreenKeyDown}
        className="relative aspect-video w-full cursor-zoom-in bg-gray-200 outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2"
        aria-label="View media fullscreen"
      >
        {current.type === 'video' ? (
          <div className="absolute inset-0" onClick={(e) => e.stopPropagation()}>
            <ListingGalleryVideo
              videoRef={inlineVideoRef}
              src={current.url}
              poster={getCloudinaryVideoThumbnailUrl(current) ?? undefined}
              className="h-full w-full"
            />
          </div>
        ) : (
          <Image
            src={current.url}
            alt={galleryMediaAltText(title, locationLabel, list, index)}
            fill
            className="object-cover"
            priority
            sizes="(max-width: 1024px) 100vw, 66vw"
            unoptimized={!current.url.includes('res.cloudinary.com')}
          />
        )}
        {isBoosted && <SponsoredLabel overlay className="absolute left-4 top-4 z-30" />}
        <ListingMarketStatusSticker soldAt={soldAt} rentedAt={rentedAt} variant="gallery" />
        <span className="absolute right-4 bottom-4 z-30 flex items-center gap-1.5 rounded-full bg-black/60 px-3 py-2 text-sm font-medium text-white">
          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" />
          </svg>
          View fullscreen
        </span>
        {/* Prev / Next – when more than one image, show on gallery (don't trigger fullscreen) */}
        {total > 1 && (
          <>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                goPrev();
              }}
              className="absolute left-3 top-1/2 z-10 -translate-y-1/2 rounded-full bg-black/60 p-3 text-white shadow hover:bg-black/80 focus:outline-none focus:ring-2 focus:ring-white/50"
              aria-label="Previous media"
            >
              <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                goNext();
              }}
              className="absolute right-3 top-1/2 z-10 -translate-y-1/2 rounded-full bg-black/60 p-3 text-white shadow hover:bg-black/80 focus:outline-none focus:ring-2 focus:ring-white/50"
              aria-label="Next media"
            >
              <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
            <div className="absolute bottom-3 left-0 right-0 flex flex-col items-center gap-2">
              <span className="rounded-full bg-black/60 px-3 py-1 text-sm font-medium text-white">
                {index + 1} / {total}
              </span>
              <div className="flex justify-center gap-1.5">
                {list.map((_, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setIndex(i);
                    }}
                    className={`h-2.5 w-2.5 rounded-full transition-colors ${i === index ? 'bg-white' : 'bg-white/50 hover:bg-white/70'}`}
                    aria-label={`Go to media ${i + 1}`}
                  />
                ))}
              </div>
            </div>
          </>
        )}
      </div>

      {/* Fullscreen lightbox */}
      {fullscreenOpen && (
        <div
          className="fixed inset-0 z-50 flex flex-col bg-black"
          role="dialog"
          aria-modal="true"
          aria-label="Media fullscreen viewer"
        >
          <div className="absolute right-4 top-4 z-20 flex items-center gap-2">
            {/* Zoom controls */}
            <div className="flex items-center gap-1 rounded-full bg-black/70 px-2 py-1.5 text-white">
              <button
                type="button"
                onClick={zoomOut}
                disabled={zoom <= MIN_ZOOM}
                className="rounded p-1.5 hover:bg-white/20 disabled:opacity-50 disabled:hover:bg-transparent"
                aria-label="Zoom out"
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
                </svg>
              </button>
              <span className="min-w-[3rem] text-center text-sm font-medium tabular-nums">{Math.round(zoom * 100)}%</span>
              <button
                type="button"
                onClick={zoomIn}
                disabled={zoom >= MAX_ZOOM}
                className="rounded p-1.5 hover:bg-white/20 disabled:opacity-50 disabled:hover:bg-transparent"
                aria-label="Zoom in"
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
              </button>
            </div>
            <button
              type="button"
              onClick={closeFullscreen}
              className="rounded-full bg-black/70 p-3 text-white hover:bg-black/90 focus:outline-none focus:ring-2 focus:ring-white"
              aria-label="Close fullscreen"
            >
              <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className="flex flex-1 overflow-auto p-4 pt-16">
            <div
              className="flex flex-shrink-0 items-center justify-center"
              style={{
                width: `${100 * zoom}%`,
                height: `${100 * zoom}%`,
                minWidth: '100%',
                minHeight: '100%',
              }}
            >
              <div className="relative h-full w-full">
                {current.type === 'video' ? (
                  <ListingGalleryVideo
                    videoRef={fullscreenVideoRef}
                    src={current.url}
                    poster={getCloudinaryVideoThumbnailUrl(current) ?? undefined}
                    className="h-full w-full"
                    size="lg"
                    objectFit="contain"
                  />
                ) : (
                  <Image
                    src={current.url}
                    alt={galleryMediaAltText(title, locationLabel, list, index)}
                    fill
                    className="object-contain"
                    unoptimized={!current.url.includes('res.cloudinary.com')}
                    sizes="100vw"
                  />
                )}
              </div>
            </div>
          </div>

          {total > 1 && (
            <>
              <button
                type="button"
                onClick={goPrev}
                className="absolute left-4 top-1/2 z-20 -translate-y-1/2 rounded-full bg-black/70 p-4 text-white hover:bg-black/90 focus:outline-none focus:ring-2 focus:ring-white"
                aria-label="Previous media"
              >
                <svg className="h-8 w-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <button
                type="button"
                onClick={goNext}
                className="absolute right-4 top-1/2 z-20 -translate-y-1/2 rounded-full bg-black/70 p-4 text-white hover:bg-black/90 focus:outline-none focus:ring-2 focus:ring-white"
                aria-label="Next media"
              >
                <svg className="h-8 w-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
              <div className="absolute bottom-4 left-0 right-0 z-20 flex justify-center gap-2">
                <span className="rounded-full bg-black/70 px-4 py-2 text-sm font-medium text-white">
                  {index + 1} / {total}
                </span>
                <div className="flex gap-2">
                  {list.map((_, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => {
                        setIndex(i);
                        setZoomIndex(0);
                      }}
                      className={`h-2.5 w-2.5 rounded-full transition-colors ${i === index ? 'bg-white' : 'bg-white/50 hover:bg-white/70'}`}
                      aria-label={`Go to media ${i + 1}`}
                    />
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </>
  );
}
