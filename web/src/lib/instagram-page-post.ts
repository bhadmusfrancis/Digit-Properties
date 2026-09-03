import { resolvePageAccessToken } from '@/lib/facebook-page-post';
import { instagramPostUrl, withCloudinaryInstagramImage, withCloudinaryInstagramVideo } from '@/lib/listing-social-post';

const GRAPH = 'https://graph.facebook.com/v21.0';

type GraphErrorBody = {
  error?: { message?: string; type?: string; code?: number; error_user_msg?: string };
  id?: string;
  permalink?: string;
  status_code?: string;
  status?: string;
  instagram_business_account?: { id?: string };
  access_token?: string;
};

function pageId(): string {
  return process.env.FACEBOOK_PAGE_ID?.trim() || '';
}

function storedToken(): string {
  return process.env.FACEBOOK_PAGE_ACCESS_TOKEN?.trim() || '';
}

function envInstagramAccountId(): string {
  return process.env.INSTAGRAM_ACCOUNT_ID?.trim() || '';
}

function graphErrorMessage(data: GraphErrorBody, fallback: string): string {
  const userMsg = data.error?.error_user_msg?.trim();
  if (userMsg) return userMsg;
  const msg = data.error?.message?.trim();
  if (msg) return msg;
  if (data.error?.code === 190) return 'Facebook Page access token is invalid or expired.';
  return fallback;
}

async function graphGet(path: string, fields: string, accessToken: string): Promise<GraphErrorBody> {
  const url = new URL(`${GRAPH}/${path}`);
  url.searchParams.set('fields', fields);
  url.searchParams.set('access_token', accessToken);
  const res = await fetch(url.toString(), { signal: AbortSignal.timeout(20000) });
  const data = (await res.json().catch(() => ({}))) as GraphErrorBody;
  if (!res.ok || data.error) {
    throw new Error(graphErrorMessage(data, `Instagram API error (${res.status})`));
  }
  return data;
}

async function graphPost(
  path: string,
  params: Record<string, string>,
  accessToken: string
): Promise<GraphErrorBody> {
  const body = new URLSearchParams(params);
  body.set('access_token', accessToken);
  const res = await fetch(`${GRAPH}/${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
    signal: AbortSignal.timeout(45000),
  });
  const data = (await res.json().catch(() => ({}))) as GraphErrorBody;
  if (!res.ok || data.error) {
    throw new Error(graphErrorMessage(data, `Instagram API error (${res.status})`));
  }
  return data;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isAspectRatioError(message: string): boolean {
  return /aspect ratio|image.*ratio|media.*ratio/i.test(message);
}

async function resolveInstagramUserId(accessToken: string): Promise<string> {
  const envId = envInstagramAccountId();
  if (envId) return envId;

  const id = pageId();
  if (!id) {
    throw new Error('Facebook Page posting is not configured. Set FACEBOOK_PAGE_ID and FACEBOOK_PAGE_ACCESS_TOKEN.');
  }

  const data = await graphGet(id, 'instagram_business_account', accessToken);
  const igId = data.instagram_business_account?.id?.trim() || '';
  if (!igId) {
    throw new Error(
      'The Facebook Page is not linked to an Instagram professional account. Connect Instagram in Meta Business Suite, or set INSTAGRAM_ACCOUNT_ID.'
    );
  }
  return igId;
}

async function waitUntilContainerReady(containerId: string, accessToken: string): Promise<void> {
  for (let i = 0; i < 12; i += 1) {
    try {
      const data = await graphGet(containerId, 'status_code,status', accessToken);
      const code = (data.status_code || '').toUpperCase();
      if (!code || code === 'FINISHED') return;
      if (code === 'ERROR' || code === 'EXPIRED') {
        throw new Error(data.status?.trim() || 'Instagram media processing failed.');
      }
    } catch (e) {
      if (e instanceof Error && /processing failed/i.test(e.message)) throw e;
    }
    await sleep(i === 0 ? 800 : 1500);
  }
}

async function createImageContainer(
  igUserId: string,
  imageUrl: string,
  accessToken: string,
  extra: Record<string, string>
): Promise<string> {
  const attempt = async (crop: 'limit' | 'square') => {
    const data = await graphPost(
      `${igUserId}/media`,
      {
        image_url: withCloudinaryInstagramImage(imageUrl, crop),
        ...extra,
      },
      accessToken
    );
    const id = String(data.id || '').trim();
    if (!id) throw new Error('Instagram image container returned no id.');
    return id;
  };

  try {
    return await attempt('limit');
  } catch (e) {
    const msg = e instanceof Error ? e.message : '';
    if (isAspectRatioError(msg)) return attempt('square');
    throw e;
  }
}

async function createReelContainer(
  igUserId: string,
  videoUrl: string,
  caption: string,
  accessToken: string
): Promise<string> {
  const data = await graphPost(
    `${igUserId}/media`,
    {
      media_type: 'REELS',
      video_url: withCloudinaryInstagramVideo(videoUrl),
      caption,
      share_to_feed: 'true',
    },
    accessToken
  );
  const id = String(data.id || '').trim();
  if (!id) throw new Error('Instagram reel container returned no id.');
  return id;
}

async function permalinkFor(mediaId: string, accessToken: string): Promise<string> {
  try {
    const data = await graphGet(mediaId, 'permalink', accessToken);
    const permalink = typeof data.permalink === 'string' ? data.permalink.trim() : '';
    if (permalink.startsWith('http')) return permalink;
  } catch {
    /* permalink is optional */
  }
  return instagramPostUrl();
}

export async function postListingToInstagram(input: {
  caption: string;
  photos: string[];
  video?: string;
}): Promise<{ postId: string; url: string }> {
  if (!pageId() || !storedToken()) {
    throw new Error('Facebook Page posting is not configured. Set FACEBOOK_PAGE_ID and FACEBOOK_PAGE_ACCESS_TOKEN.');
  }
  if (input.photos.length === 0 && !input.video) {
    throw new Error('Instagram requires at least one photo or video.');
  }

  const accessToken = await resolvePageAccessToken();
  const igUserId = await resolveInstagramUserId(accessToken);

  let containerId = '';
  if (input.photos.length === 1) {
    containerId = await createImageContainer(igUserId, input.photos[0], accessToken, {
      caption: input.caption,
    });
  } else if (input.photos.length > 1) {
    const children: { id: string; photo: string }[] = [];
    const errors: string[] = [];
    for (const photo of input.photos) {
      try {
        children.push({
          id: await createImageContainer(igUserId, photo, accessToken, { is_carousel_item: 'true' }),
          photo,
        });
      } catch (e) {
        errors.push(e instanceof Error ? e.message : 'Photo container failed');
      }
    }
    if (children.length >= 2) {
      const parent = await graphPost(
        `${igUserId}/media`,
        {
          media_type: 'CAROUSEL',
          children: children.map((c) => c.id).join(','),
          caption: input.caption,
        },
        accessToken
      );
      containerId = String(parent.id || '').trim();
      if (!containerId) throw new Error('Instagram carousel container returned no id.');
    } else if (children.length === 1) {
      containerId = await createImageContainer(igUserId, children[0].photo, accessToken, {
        caption: input.caption,
      });
    } else {
      throw new Error(errors[0] || 'Instagram photo upload failed.');
    }
  } else if (input.video) {
    containerId = await createReelContainer(igUserId, input.video, input.caption, accessToken);
  }

  await waitUntilContainerReady(containerId, accessToken);

  const published = await graphPost(`${igUserId}/media_publish`, { creation_id: containerId }, accessToken);
  const postId = String(published.id || '').trim();
  if (!postId) throw new Error('Instagram did not return a post id.');
  return { postId, url: await permalinkFor(postId, accessToken) };
}
