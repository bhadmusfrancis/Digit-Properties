import { facebookPostUrl } from '@/lib/listing-social-post';

const GRAPH = 'https://graph.facebook.com/v21.0';

type GraphErrorBody = {
  error?: { message?: string; type?: string; code?: number };
  id?: string;
  post_id?: string;
  permalink_url?: string;
};

function pageId(): string {
  return process.env.FACEBOOK_PAGE_ID?.trim() || '';
}

function pageToken(): string {
  return process.env.FACEBOOK_PAGE_ACCESS_TOKEN?.trim() || '';
}

function graphErrorMessage(data: GraphErrorBody, fallback: string): string {
  const msg = data.error?.message?.trim();
  if (msg) return msg;
  if (data.error?.code === 190) return 'Facebook Page access token is invalid or expired.';
  return fallback;
}

async function graphPost(path: string, params: Record<string, string>): Promise<GraphErrorBody> {
  const body = new URLSearchParams(params);
  body.set('access_token', pageToken());
  const res = await fetch(`${GRAPH}/${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
    signal: AbortSignal.timeout(45000),
  });
  const data = (await res.json().catch(() => ({}))) as GraphErrorBody;
  if (!res.ok || data.error) {
    throw new Error(graphErrorMessage(data, `Facebook API error (${res.status})`));
  }
  return data;
}

function resultFromGraph(data: GraphErrorBody): { postId: string; url: string } {
  const postId = String(data.post_id || data.id || '').trim();
  if (!postId) throw new Error('Facebook did not return a post id.');
  if (typeof data.permalink_url === 'string' && data.permalink_url.startsWith('http')) {
    return { postId, url: data.permalink_url };
  }
  if (!postId.includes('_') && pageId()) {
    return { postId, url: `https://www.facebook.com/${pageId()}/videos/${postId}` };
  }
  return { postId, url: facebookPostUrl(postId) };
}

async function uploadUnpublishedPhoto(imageUrl: string): Promise<string> {
  const data = await graphPost(`${pageId()}/photos`, {
    url: imageUrl,
    published: 'false',
  });
  const id = String(data.id || '').trim();
  if (!id) throw new Error('Facebook photo upload returned no id.');
  return id;
}

export async function postListingToFacebookPage(input: {
  caption: string;
  listingUrl: string;
  photos: string[];
  video?: string;
}): Promise<{ postId: string; url: string }> {
  if (!pageId() || !pageToken()) {
    throw new Error('Facebook Page posting is not configured. Set FACEBOOK_PAGE_ID and FACEBOOK_PAGE_ACCESS_TOKEN.');
  }

  if (input.photos.length > 0) {
    const mediaIds: string[] = [];
    const errors: string[] = [];
    for (const photo of input.photos) {
      try {
        mediaIds.push(await uploadUnpublishedPhoto(photo));
      } catch (e) {
        errors.push(e instanceof Error ? e.message : 'Photo upload failed');
      }
    }
    if (mediaIds.length === 0) {
      throw new Error(errors[0] || 'Could not upload listing photos to Facebook.');
    }
    const params: Record<string, string> = { message: input.caption };
    mediaIds.forEach((id, i) => {
      params[`attached_media[${i}]`] = JSON.stringify({ media_fbid: id });
    });
    return resultFromGraph(await graphPost(`${pageId()}/feed`, params));
  }

  if (input.video) {
    return resultFromGraph(
      await graphPost(`${pageId()}/videos`, {
        file_url: input.video,
        description: input.caption,
      })
    );
  }

  return resultFromGraph(
    await graphPost(`${pageId()}/feed`, {
      message: input.caption,
      link: input.listingUrl,
    })
  );
}
