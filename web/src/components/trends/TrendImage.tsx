'use client';

import { useState } from 'react';

const FALLBACK = 'data:image/svg+xml,' + encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="800" height="450" viewBox="0 0 800 450"><rect fill="#e5e7eb" width="800" height="450"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="#9ca3af" font-family="sans-serif" font-size="18">Image</text></svg>'
);

type TrendImageProps = {
  src: string;
  alt?: string;
  fill?: boolean;
  className?: string;
  sizes?: string;
  priority?: boolean;
  objectFit?: 'cover' | 'contain';
};

export function TrendImage({ src, alt = '', fill, className = '', sizes, priority, objectFit = 'cover' }: TrendImageProps) {
  const [url, setUrl] = useState(src);

  const handleError = () => setUrl(FALLBACK);

  const style = fill ? { position: 'absolute' as const, inset: 0, width: '100%', height: '100%', objectFit } : undefined;

  return (
    <img
      src={url}
      alt={alt}
      className={className}
      style={style}
      sizes={sizes}
      loading={priority ? 'eager' : 'lazy'}
      onError={handleError}
      decoding="async"
    />
  );
}
