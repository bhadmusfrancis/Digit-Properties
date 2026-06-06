import { getCloudinaryVideoThumbnailUrl } from '@/lib/listing-default-image';
import { normalizeVideoContentUrl } from '@/lib/seo/listing-videos';

type ListingWatchVideoProps = {
  src: string;
  public_id?: string;
  title: string;
};

/** Server-rendered player for Google video indexing (watch page primary content). */
export function ListingWatchVideo({ src, public_id, title }: ListingWatchVideoProps) {
  const videoSrc = normalizeVideoContentUrl(src);
  const poster = getCloudinaryVideoThumbnailUrl({ url: src, public_id }) ?? undefined;

  return (
    <video
      src={videoSrc}
      poster={poster}
      controls
      playsInline
      preload="metadata"
      className="aspect-video w-full rounded-lg bg-black"
      title={title}
    />
  );
}
