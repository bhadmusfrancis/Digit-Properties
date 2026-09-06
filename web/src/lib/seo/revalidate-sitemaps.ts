import { revalidatePath } from 'next/cache';

const SITEMAP_PATHS = ['/sitemap.xml', '/image-sitemap.xml', '/video-sitemap.xml'] as const;

/** Bust cached sitemaps after listing/media changes so Google picks up new URLs quickly. */
export function revalidateAllSitemaps(): void {
  for (const path of SITEMAP_PATHS) {
    try {
      revalidatePath(path);
    } catch (e) {
      console.error('[revalidate-sitemaps]', path, e);
    }
  }
}

/** Refresh sitemaps and listing/video watch pages after create or update. */
export function revalidateListingSeoSurfaces(input: { publicPath: string; videoCount?: number }): void {
  revalidateAllSitemaps();
  try {
    revalidatePath(input.publicPath);
    const count = Math.max(0, input.videoCount ?? 0);
    for (let i = 0; i < count; i++) {
      revalidatePath(`${input.publicPath}/video/${i + 1}`);
    }
  } catch (e) {
    console.error('[revalidate-sitemaps] listing pages', e);
  }
}

/** Refresh sitemaps and public Trends pages after create or update. */
export function revalidateTrendSeoSurfaces(input?: { slug?: string }): void {
  revalidateAllSitemaps();
  try {
    revalidatePath('/trends');
    if (input?.slug) revalidatePath(`/trends/${input.slug}`);
  } catch (e) {
    console.error('[revalidate-sitemaps] trends pages', e);
  }
}
