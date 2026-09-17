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

/** Meta processes containers asynchronously; publishing early fails with "media still loading". */
const CONTAINER_READY_BUDGET_MS = 60000;
const CONTAINER_POLL_MS = 3000;

/** Returns true once the container reports FINISHED (or no status for plain image containers). */
async function waitUntilContainerReady(
  containerId: string,
  accessToken: string,
  budgetMs: number = CONTAINER_READY_BUDGET_MS
): Promise<boolean> {
  const deadline = Date.now() + budgetMs;
  while (Date.now() < deadline) {
    let terminalError: string | null = null;
    try {
      const data = await graphGet(containerId, 'status_code,status', accessToken);
      const code = (data.status_code || '').toUpperCase();
      if (!code || code === 'FINISHED' || code === 'PUBLISHED') return true;
      if (code === 'ERROR' || code === 'EXPIRED') {
        terminalError = data.status?.trim() || 'Instagram media processing failed.';
      }
    } catch {
      /* transient status errors: keep polling until the deadline */
    }
    if (terminalError) throw new Error(terminalError);
    await sleep(CONTAINER_POLL_MS);
  }
  return false;
}

/** Meta rejects media_publish while a container is still being fetched/processed. */
function isMediaNotReadyError(message: string): boolean {
  return /not available|still (being )?(processed|processing|loading)|media.*(load|process|ready)|in progress|try again/i.test(
    message
  );
}

async function publishContainer(
  igUserId: string,
  containerId: string,
  accessToken: string
): Promise<{ postId: string; url: string }> {
  let lastError: Error | null = null;
  for (let attempt = 0; attempt < 4; attempt += 1) {
    try {
      const published = await graphPost(
        `${igUserId}/media_publish`,
        { creation_id: containerId },
        accessToken
      );
      const postId = String(published.id || '').trim();
      if (!postId) throw new Error('Instagram did not return a post id.');
      return { postId, url: await permalinkFor(postId, accessToken) };
    } catch (e) {
      lastError = e instanceof Error ? e : new Error('Instagram publish failed.');
      if (!isMediaNotReadyError(lastError.message) || attempt === 3) throw lastError;
      await sleep(4000);
      await waitUntilContainerReady(containerId, accessToken, 15000).catch(() => false);
    }
  }
  throw lastError ?? new Error('Instagram publish failed.');
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

/**
 * Comment on an Instagram media object as the professional account.
 * The Instagram Graph API does not support media attachments on comments — text only.
 */
export async function postCommentOnInstagramMedia(input: {
  mediaId: string;
  message: string;
}): Promise<{ commentId: string }> {
  if (!pageId() || !storedToken()) {
    throw new Error('Facebook Page posting is not configured. Set FACEBOOK_PAGE_ID and FACEBOOK_PAGE_ACCESS_TOKEN.');
  }
  const mediaId = input.mediaId.trim();
  if (!mediaId) throw new Error('Missing Instagram media id.');

  const accessToken = await resolvePageAccessToken();
  const data = await graphPost(`${mediaId}/comments`, { message: input.message }, accessToken);
  const commentId = String(data.id || '').trim();
  if (!commentId) throw new Error('Instagram did not return a comment id.');
  return { commentId };
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
      // Each carousel child must finish processing before the parent can be created/published.
      await Promise.all(children.map((c) => waitUntilContainerReady(c.id, accessToken)));
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

  return publishContainer(igUserId, containerId, accessToken);
}
