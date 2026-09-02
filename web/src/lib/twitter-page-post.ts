import { createHmac, randomBytes } from 'crypto';
import { twitterPostUrl, withCloudinaryTwitterImage } from '@/lib/listing-social-post';

const TWEET_URL = 'https://api.twitter.com/2/tweets';
const MEDIA_UPLOAD_URL = 'https://upload.twitter.com/1.1/media/upload.json';
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const MAX_VIDEO_BYTES = 12 * 1024 * 1024;
const VIDEO_CHUNK_BYTES = 4 * 1024 * 1024;

function requireTwitterEnv(): {
  consumerKey: string;
  consumerSecret: string;
  token: string;
  tokenSecret: string;
} {
  const consumerKey = process.env.TWITTER_API_KEY?.trim() || '';
  const consumerSecret = process.env.TWITTER_API_SECRET?.trim() || '';
  const token = process.env.TWITTER_ACCESS_TOKEN?.trim() || '';
  const tokenSecret = process.env.TWITTER_ACCESS_TOKEN_SECRET?.trim() || '';
  if (!consumerKey || !consumerSecret || !token || !tokenSecret) {
    throw new Error(
      'X posting is not configured. Set TWITTER_API_KEY, TWITTER_API_SECRET, TWITTER_ACCESS_TOKEN, and TWITTER_ACCESS_TOKEN_SECRET.'
    );
  }
  return { consumerKey, consumerSecret, token, tokenSecret };
}

function percentEncode(value: string): string {
  return encodeURIComponent(value).replace(/[!'()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);
}

function oauthHeader(method: string, url: string, extraParams: Record<string, string> = {}): string {
  const env = requireTwitterEnv();
  const oauth: Record<string, string> = {
    oauth_consumer_key: env.consumerKey,
    oauth_nonce: randomBytes(16).toString('hex'),
    oauth_signature_method: 'HMAC-SHA1',
    oauth_timestamp: Math.floor(Date.now() / 1000).toString(),
    oauth_token: env.token,
    oauth_version: '1.0',
  };
  const all = { ...oauth, ...extraParams };
  const paramString = Object.keys(all)
    .sort()
    .map((k) => `${percentEncode(k)}=${percentEncode(all[k])}`)
    .join('&');
  const base = [method.toUpperCase(), percentEncode(url), percentEncode(paramString)].join('&');
  const signingKey = `${percentEncode(env.consumerSecret)}&${percentEncode(env.tokenSecret)}`;
  oauth.oauth_signature = createHmac('sha1', signingKey).update(base).digest('base64');
  return `OAuth ${Object.keys(oauth)
    .sort()
    .map((k) => `${percentEncode(k)}="${percentEncode(oauth[k])}"`)
    .join(', ')}`;
}

async function twitterFetch(
  method: string,
  url: string,
  opts?: { query?: Record<string, string>; json?: unknown; form?: FormData }
): Promise<Response> {
  const query = opts?.query ?? {};
  const target = new URL(url);
  for (const [k, v] of Object.entries(query)) target.searchParams.set(k, v);
  const headers: Record<string, string> = {
    Authorization: oauthHeader(method, `${target.origin}${target.pathname}`, query),
  };
  let body: BodyInit | undefined;
  if (opts?.json !== undefined) {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(opts.json);
  } else if (opts?.form) {
    body = opts.form;
  }
  return fetch(target.toString(), {
    method,
    headers,
    body,
    signal: AbortSignal.timeout(45000),
  });
}

async function fetchLimitedBytes(
  url: string,
  maxBytes: number
): Promise<{ bytes: Buffer; contentType: string } | null> {
  const res = await fetch(url, { signal: AbortSignal.timeout(25000) });
  if (!res.ok) return null;
  const len = Number(res.headers.get('content-length') || 0);
  if (len > maxBytes) return null;
  const bytes = Buffer.from(await res.arrayBuffer());
  if (bytes.length === 0 || bytes.length > maxBytes) return null;
  return { bytes, contentType: res.headers.get('content-type') || 'application/octet-stream' };
}

async function uploadImage(url: string): Promise<string | null> {
  const fetched = await fetchLimitedBytes(withCloudinaryTwitterImage(url), MAX_IMAGE_BYTES);
  if (!fetched) return null;
  const form = new FormData();
  form.append('media_data', fetched.bytes.toString('base64'));
  const res = await twitterFetch('POST', MEDIA_UPLOAD_URL, { form });
  const data = (await res.json().catch(() => ({}))) as { media_id_string?: string; errors?: { message?: string }[] };
  if (!res.ok || !data.media_id_string) return null;
  return data.media_id_string;
}

async function waitForVideo(mediaId: string): Promise<boolean> {
  for (let i = 0; i < 8; i += 1) {
    const res = await twitterFetch('GET', MEDIA_UPLOAD_URL, {
      query: { command: 'STATUS', media_id: mediaId },
    });
    const data = (await res.json().catch(() => ({}))) as {
      processing_info?: { state?: string; check_after_secs?: number; error?: { message?: string } };
    };
    const state = data.processing_info?.state;
    if (!state || state === 'succeeded') return true;
    if (state === 'failed') return false;
    const waitSec = Math.min(Math.max(data.processing_info?.check_after_secs ?? 2, 1), 5);
    await new Promise((r) => setTimeout(r, waitSec * 1000));
  }
  return true;
}

async function uploadVideo(url: string): Promise<string | null> {
  const fetched = await fetchLimitedBytes(url, MAX_VIDEO_BYTES);
  if (!fetched) return null;
  const init = await twitterFetch('POST', MEDIA_UPLOAD_URL, {
    query: {
      command: 'INIT',
      total_bytes: String(fetched.bytes.length),
      media_type: fetched.contentType.includes('video') ? fetched.contentType.split(';')[0] : 'video/mp4',
      media_category: 'tweet_video',
    },
  });
  const initData = (await init.json().catch(() => ({}))) as { media_id_string?: string };
  const mediaId = initData.media_id_string;
  if (!init.ok || !mediaId) return null;

  let segment = 0;
  for (let offset = 0; offset < fetched.bytes.length; offset += VIDEO_CHUNK_BYTES) {
    const chunk = fetched.bytes.subarray(offset, offset + VIDEO_CHUNK_BYTES);
    const form = new FormData();
    form.append('media_data', Buffer.from(chunk).toString('base64'));
    const appendRes = await twitterFetch('POST', MEDIA_UPLOAD_URL, {
      query: {
        command: 'APPEND',
        media_id: mediaId,
        segment_index: String(segment),
      },
      form,
    });
    if (!appendRes.ok) return null;
    segment += 1;
  }

  const finalize = await twitterFetch('POST', MEDIA_UPLOAD_URL, {
    query: { command: 'FINALIZE', media_id: mediaId },
  });
  if (!finalize.ok) return null;
  const ready = await waitForVideo(mediaId);
  return ready ? mediaId : null;
}

function twitterErrorMessage(data: unknown, status: number): string {
  if (data && typeof data === 'object') {
    const rec = data as {
      detail?: string;
      title?: string;
      errors?: { message?: string }[];
    };
    const parts = [rec.detail, rec.title, rec.errors?.[0]?.message]
      .filter((v): v is string => typeof v === 'string' && Boolean(v.trim()))
      .join(' ');
    if (/credit/i.test(parts) || /deplet/i.test(parts)) {
      return 'X API credits are depleted. Add credits in console.x.com → Billing, then try again.';
    }
    if (typeof rec.detail === 'string' && rec.detail.trim()) return rec.detail.trim();
    if (rec.errors?.[0]?.message) return rec.errors[0].message;
    if (typeof rec.title === 'string' && rec.title.trim()) return rec.title.trim();
  }
  if (status === 401 || status === 403) {
    return 'X API rejected the request. Check that the app has Read and Write access and the access tokens belong to @DigitProperties.';
  }
  return `X API error (${status})`;
}

export async function postListingToTwitter(input: {
  text: string;
  photos: string[];
  video?: string;
}): Promise<{ postId: string; url: string }> {
  requireTwitterEnv();

  const mediaIds: string[] = [];
  if (input.photos.length) {
    for (const photo of input.photos) {
      const id = await uploadImage(photo);
      if (id) mediaIds.push(id);
    }
  } else if (input.video) {
    const id = await uploadVideo(input.video);
    if (id) mediaIds.push(id);
  }

  const payload: { text: string; media?: { media_ids: string[] } } = { text: input.text };
  if (mediaIds.length) payload.media = { media_ids: mediaIds };

  const res = await twitterFetch('POST', TWEET_URL, { json: payload });
  const data = (await res.json().catch(() => ({}))) as { data?: { id?: string } };
  if (!res.ok || !data.data?.id) {
    throw new Error(twitterErrorMessage(data, res.status));
  }
  const postId = data.data.id;
  return { postId, url: twitterPostUrl(postId) };
}
