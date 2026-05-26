import type { ListingVideoSeoItem } from '@/lib/seo/listing-videos';

/**
 * Server-rendered video links for crawlers (in addition to VideoObject JSON-LD).
 * Hidden visually; keeps playable URLs in the initial HTML.
 */
export function ListingVideoSeo({ videos }: { videos: ListingVideoSeoItem[] }) {
  if (!videos.length) return null;

  return (
    <div className="sr-only" aria-hidden>
      {videos.map((video) => (
        <div key={video.contentUrl}>
          <a href={video.contentUrl}>{video.name}</a>
          <video
            poster={video.thumbnailUrl}
            preload="metadata"
            playsInline
            muted
            tabIndex={-1}
          >
            <source src={video.contentUrl} type="video/mp4" />
          </video>
        </div>
      ))}
    </div>
  );
}
