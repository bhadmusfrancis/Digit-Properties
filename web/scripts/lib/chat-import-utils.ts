import { createHash } from 'crypto';
import { existsSync, readFileSync, statSync, writeFileSync } from 'fs';
import path from 'path';

import { findDuplicateAmongCandidates } from '../../src/lib/listing-dedupe';
import { ALL_CHATS_PATH } from './chat-import-paths';

export const ATTACHED_RE = /<attached:\s*([^>]+)>/gi;
export const MSG_HEADER_RE = /^\[\d{1,2}\/\d{1,2}\/\d{2,4},/;

export const MEDIA_EXT: Record<string, 'image' | 'video'> = {
  '.jpg': 'image',
  '.jpeg': 'image',
  '.png': 'image',
  '.webp': 'image',
  '.mp4': 'video',
  '.webm': 'video',
  '.mov': 'video',
};

export const DEDUP_SIMILARITY = 90;
export const DEDUP_MIN_CHARS = 55;

export function splitChatMessages(raw: string): string[] {
  const lines = raw.split(/\r?\n/);
  const messages: string[] = [];
  let buf: string[] = [];
  for (const line of lines) {
    if (MSG_HEADER_RE.test(line)) {
      if (buf.length > 0) messages.push(buf.join('\n'));
      buf = [line];
    } else {
      buf.push(line);
    }
  }
  if (buf.length > 0) messages.push(buf.join('\n'));
  return messages;
}

export function parseMessageMeta(full: string): {
  body: string;
  senderName: string;
  senderPhone: string | undefined;
  sentAt: Date | null;
} {
  // Allow one or more leading tilde markers so the WhatsApp "double-tilde"
  // header (e.g. `[date] ~ ~ Name ~ (+234 …):`) parses like the single-tilde
  // form. Without this the whole header would fall through into `body`.
  const m = full.match(
    /^\[([^\]]+)\]\s+(?:~\s+)+([^~]+?)\s+~\s+\(([^)]*)\):\s*([\s\S]*)$/
  );
  if (!m) {
    return { body: full.trim(), senderName: '', senderPhone: undefined, sentAt: null };
  }
  const dtRaw = m[1].trim();
  const senderName = m[2].trim();
  const phoneRaw = m[3].trim();
  let senderPhone: string | undefined;
  if (phoneRaw && phoneRaw !== 'unknown') {
    let p = phoneRaw.replace(/\s/g, '');
    if (p.startsWith('0')) p = '+234' + p.slice(1);
    else if (!p.startsWith('+') && /^\d/.test(p)) p = '+' + p;
    senderPhone = p;
  }
  const sentAt = parseWhatsappDate(dtRaw);
  return { body: m[4].trim(), senderName, senderPhone, sentAt };
}

export function parseWhatsappDate(dtRaw: string): Date | null {
  const s = dtRaw.replace(/\u202f|\u00a0/g, ' ').trim();
  const re = /^(\d{1,2})\/(\d{1,2})\/(\d{2,4}),\s*(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)$/i;
  const m = s.match(re);
  if (m) {
    const yy = Number(m[3]);
    const year = yy < 100 ? 2000 + yy : yy;
    let hh = Number(m[4]);
    const mm = Number(m[5]);
    const ss = Number(m[6] ?? '0');
    const ampm = String(m[7]).toUpperCase();
    if (ampm === 'PM' && hh < 12) hh += 12;
    if (ampm === 'AM' && hh === 12) hh = 0;
    return new Date(year, Number(m[1]) - 1, Number(m[2]), hh, mm, ss);
  }
  return null;
}

export function extractAttachmentFilenames(body: string): string[] {
  const names: string[] = [];
  let exec: RegExpExecArray | null;
  const re = new RegExp(ATTACHED_RE.source, 'gi');
  while ((exec = re.exec(body)) !== null) {
    names.push(exec[1].trim());
  }
  return [...new Set(names)];
}

export function cleanBodyForParser(body: string): string {
  return body
    .replace(/<attached:\s*[^>]+>/gi, '')
    .replace(/\u200e/g, '')
    .replace(/\bimage omitted\b/gi, '')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .join('\n')
    .trim();
}

export function listingFingerprint(cleanBody: string, senderPhone?: string): string {
  const normalized = normalizeForDedup(cleanBody);
  const payload = `${senderPhone ?? 'unknown'}|${normalized}`;
  return createHash('sha1').update(payload).digest('hex');
}

export function normalizeForDedup(body: string): string {
  return body
    .replace(/<attached:\s*[^>]+>/gi, ' ')
    .replace(/\bimage\s+omitted\b/gi, ' ')
    .replace(/https?:\/\S+/gi, ' ')
    .replace(/\d+/g, ' # ')
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Token-overlap similarity 0–100 (approximates fuzzy dedup in build_chat.py). */
export function bodySimilarity(a: string, b: string): number {
  const na = normalizeForDedup(a);
  const nb = normalizeForDedup(b);
  if (!na || !nb) return 0;
  if (na === nb) return 100;
  const ta = na.split(' ').filter(Boolean).sort();
  const tb = nb.split(' ').filter(Boolean).sort();
  if (ta.join(' ') === tb.join(' ')) return 100;
  const setA = new Set(ta);
  const setB = new Set(tb);
  let inter = 0;
  for (const w of setA) if (setB.has(w)) inter++;
  const union = new Set([...setA, ...setB]).size;
  return union ? Math.round((inter / union) * 100) : 0;
}

export function isDuplicateOfCanonical(
  clean: string,
  senderPhone: string | undefined,
  fp: string,
  canonicalFps: Set<string>,
  canonicalBodies: string[]
): boolean {
  if (canonicalFps.has(fp)) return true;
  if (clean.length < DEDUP_MIN_CHARS) return false;
  for (const prev of canonicalBodies) {
    if (prev.length < DEDUP_MIN_CHARS) continue;
    if (bodySimilarity(clean, prev) >= DEDUP_SIMILARITY) return true;
  }
  return false;
}

type ListingLite = {
  _id: unknown;
  title?: string;
  description?: string;
  location?: { city?: string; state?: string; suburb?: string };
  images?: { public_id?: string }[];
  videos?: { public_id?: string }[];
};

export type AuthorImportDedupeIndex = {
  dbFps: Set<string>;
  usedAttachments: Set<string>;
  listingCandidates: ListingLite[];
  listingBodies: string[];
};

/** Load fingerprint tags, attachment tags, and listing rows for pre-upload dedupe. */
export async function buildAuthorImportDedupeIndex(
  authorId: unknown,
  Listing: {
    find: (filter: Record<string, unknown>) => {
      select: (fields: string) => { lean: () => Promise<unknown[]> };
    };
  }
): Promise<AuthorImportDedupeIndex> {
  const dbFps = new Set<string>();
  const usedAttachments = new Set<string>();
  const listingBodies: string[] = [];

  const tagged = await Listing.find({
    createdBy: authorId,
    tags: 'whatsapp-chat-import',
  })
    .select('tags description')
    .lean();

  for (const row of tagged) {
    const r = row as { tags?: string[]; description?: string };
    const tags = Array.isArray(r.tags) ? r.tags : [];
    for (const t of tags) {
      if (t.startsWith('wa-fp:')) dbFps.add(t.slice('wa-fp:'.length));
      if (t.startsWith('wa-att:')) usedAttachments.add(t.slice('wa-att:'.length));
    }
    const desc = r.description?.trim();
    if (desc && desc.length >= DEDUP_MIN_CHARS) listingBodies.push(cleanBodyForParser(desc));
  }

  const candidates = await Listing.find({
    createdBy: authorId,
    status: { $in: ['draft', 'active', 'paused', 'pending_approval'] },
  })
    .select('title description location images videos')
    .limit(250)
    .lean();

  return {
    dbFps,
    usedAttachments,
    listingCandidates: candidates as ListingLite[],
    listingBodies,
  };
}

export type ChatImportDedupeState = {
  canonicalFps: Set<string>;
  canonicalBodies: string[];
  dbFps: Set<string>;
  batchSeenFp: Set<string>;
  seenBodies: string[];
  usedAttachments: Set<string>;
  listingCandidates: ListingLite[];
};

export function createChatImportDedupeState(
  canonicalFps: Set<string>,
  canonicalBodies: string[],
  authorIndex: AuthorImportDedupeIndex
): ChatImportDedupeState {
  return {
    canonicalFps,
    canonicalBodies,
    dbFps: new Set(authorIndex.dbFps),
    batchSeenFp: new Set<string>(),
    seenBodies: [...canonicalBodies, ...authorIndex.listingBodies],
    usedAttachments: new Set(authorIndex.usedAttachments),
    listingCandidates: authorIndex.listingCandidates,
  };
}

/** All duplicate checks that must run before uploading media to Cloudinary. */
export function shouldSkipChatImportBeforeUpload(
  params: {
    clean: string;
    senderPhone?: string;
    title: string;
    description: string;
    location?: { city?: string; state?: string; suburb?: string };
    attachmentFilenames: string[];
  },
  state: ChatImportDedupeState
): { skip: true; reason: string } | { skip: false; fp: string } {
  const fp = listingFingerprint(params.clean, params.senderPhone);

  if (state.batchSeenFp.has(fp) || state.dbFps.has(fp)) {
    return { skip: true, reason: 'duplicate fingerprint (already imported)' };
  }
  if (isDuplicateOfCanonical(params.clean, params.senderPhone, fp, state.canonicalFps, state.canonicalBodies)) {
    return { skip: true, reason: 'duplicate in All_chats.txt' };
  }
  if (isDuplicateOfCanonical(params.clean, params.senderPhone, fp, new Set(), state.seenBodies)) {
    return { skip: true, reason: 'similar to existing listing or message in batch' };
  }
  for (const f of params.attachmentFilenames) {
    if (state.usedAttachments.has(f)) {
      return { skip: true, reason: `attachment already used (${f})` };
    }
  }
  const listingDup = findDuplicateAmongCandidates(state.listingCandidates, undefined, {
    title: params.title,
    description: params.description,
    location: params.location,
    mediaPublicIds: [],
  });
  if (listingDup) {
    return { skip: true, reason: listingDup.message };
  }
  return { skip: false, fp };
}

export function markChatImportAccepted(
  state: ChatImportDedupeState,
  fp: string,
  clean: string,
  attachmentFilenames: string[]
): void {
  state.batchSeenFp.add(fp);
  state.dbFps.add(fp);
  if (clean.length >= DEDUP_MIN_CHARS) state.seenBodies.push(clean);
  for (const f of attachmentFilenames) state.usedAttachments.add(f);
}

export function hasResolvableMedia(files: string[], mediaDir: string): boolean {
  for (const fname of files) {
    const ext = path.extname(fname).toLowerCase();
    if (!MEDIA_EXT[ext]) continue;
    const localPath = path.join(mediaDir, fname);
    if (!existsSync(localPath)) continue;
    if (MEDIA_EXT[ext] === 'video') {
      const fileSizeMb = statSync(localPath).size / (1024 * 1024);
      if (fileSizeMb > 40) continue;
    }
    return true;
  }
  return false;
}

export function tsTagFromDate(d: Date | null): string | null {
  if (!d) return null;
  const pad = (n: number) => String(n).padStart(2, '0');
  const tag = `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
  return `wa-ts:${tag}`;
}

export type ParsedChatMessage = {
  index: number;
  full: string;
  body: string;
  clean: string;
  senderName: string;
  senderPhone?: string;
  files: string[];
  sentAt: Date | null;
};

/** Upload timeout: images 2 min; videos scale ~25s/MB, capped at 10 min. */
export function cloudinaryUploadTimeoutMs(filePath: string, kind: 'image' | 'video'): number {
  if (kind === 'image') return 120_000;
  const mb = statSync(filePath).size / (1024 * 1024);
  return Math.min(600_000, 120_000 + Math.round(mb * 25_000));
}

export function looksLikeListingFromClean(
  clean: string,
  parsed: { parsed: { price: number; bedrooms: number; area?: number } }
): boolean {
  return (
    parsed.parsed.price > 0 ||
    parsed.parsed.bedrooms > 0 ||
    (parsed.parsed.area ?? 0) > 0 ||
    (clean.length >= 40 &&
      /\b(rent|sale|bed|bath|₦|m\b|k\b|sqm|bn\b|jv\b|joint\s+venture|land|plot|duplex|apartment|to\s+let|letting)\b/i.test(
        clean
      ))
  );
}

const LARGE_VIDEO_MB = 18;

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function isRetryableUploadError(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  const e = err as { http_code?: number; name?: string; message?: string };
  if (e.http_code === 499 || e.http_code === 504 || e.http_code === 503) return true;
  if (e.name === 'TimeoutError') return true;
  const msg = String(e.message ?? err);
  return /timeout|timed out|econnreset|network/i.test(msg);
}

type CloudinaryUploadResult = { secure_url?: string; public_id?: string };

function promisifyUpload<T>(
  fn: (opts: object, cb: (err: unknown, res: T) => void) => void,
  opts: object
): Promise<T> {
  return new Promise((resolve, reject) => {
    fn(opts, (err, res) => {
      if (err) reject(err);
      else resolve(res);
    });
  });
}

/**
 * Upload listing media to Cloudinary with retries.
 * Large videos (≥18MB) use chunked upload_large; others upload from disk path.
 */
export async function uploadListingMediaToCloudinary(
  cloudinary: typeof import('cloudinary').v2,
  filePath: string,
  kind: 'image' | 'video'
): Promise<{ url: string; public_id: string }> {
  const resource_type = kind === 'video' ? 'video' : 'image';
  const mb = statSync(filePath).size / (1024 * 1024);
  const maxAttempts = 3;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      let res: CloudinaryUploadResult;

      if (kind === 'image') {
        const buffer = readFileSync(filePath);
        const timeoutMs = cloudinaryUploadTimeoutMs(filePath, kind);
        res = await new Promise<CloudinaryUploadResult>((resolve, reject) => {
          const timer = setTimeout(() => {
            reject(new Error(`Upload timeout (${Math.round(timeoutMs / 1000)}s)`));
          }, timeoutMs);
          const stream = cloudinary.uploader.upload_stream(
            {
              folder: 'listings',
              resource_type: 'image',
              transformation: [{ width: 1920, crop: 'limit', quality: 'auto' }],
            },
            (err, result) => {
              clearTimeout(timer);
              if (err) reject(err);
              else resolve(result ?? {});
            }
          );
          stream.end(buffer);
        });
      } else if (mb >= LARGE_VIDEO_MB) {
        const uploader = cloudinary.uploader as typeof cloudinary.uploader & {
          upload_large?: (
            file: string,
            opts: object,
            cb?: (err: unknown, res: CloudinaryUploadResult) => void
          ) => Promise<CloudinaryUploadResult> | void;
        };
        const opts = {
          folder: 'listings',
          resource_type: 'video' as const,
          chunk_size: 6_000_000,
          timeout: 600_000,
        };
        if (typeof uploader.upload_large === 'function') {
          const maybe = uploader.upload_large(filePath, opts);
          res =
            maybe && typeof (maybe as Promise<CloudinaryUploadResult>).then === 'function'
              ? await (maybe as Promise<CloudinaryUploadResult>)
              : await promisifyUpload<CloudinaryUploadResult>(
                  (o, cb) => uploader.upload_large!(filePath, o, cb),
                  opts
                );
        } else {
          res = await cloudinary.uploader.upload(filePath, { ...opts, resource_type: 'video' });
        }
      } else {
        const timeoutMs = cloudinaryUploadTimeoutMs(filePath, kind);
        res = await cloudinary.uploader.upload(filePath, {
          folder: 'listings',
          resource_type: 'video',
          timeout: timeoutMs,
        });
      }

      if (res?.secure_url && res?.public_id) {
        return { url: res.secure_url, public_id: res.public_id };
      }
      throw new Error('Upload failed: missing secure_url');
    } catch (err) {
      if (attempt < maxAttempts && isRetryableUploadError(err)) {
        console.warn(
          `  upload retry ${attempt}/${maxAttempts - 1} for ${path.basename(filePath)}:`,
          err
        );
        await sleep(8000 * attempt);
        continue;
      }
      throw err;
    }
  }

  throw new Error('Upload failed after retries');
}

/** Remove duplicate message fingerprints from the global All_chats.txt archive. */
export function dedupeAllChatsArchive(): { before: number; after: number; removed: number } {
  if (!existsSync(ALL_CHATS_PATH)) {
    return { before: 0, after: 0, removed: 0 };
  }
  const raw = readFileSync(ALL_CHATS_PATH, 'utf8');
  const messages = splitChatMessages(raw);
  const seen = new Set<string>();
  const kept: string[] = [];
  let removed = 0;
  for (const full of messages) {
    const { body, senderPhone } = parseMessageMeta(full);
    const clean = cleanBodyForParser(body);
    const key = clean.length >= 15 ? listingFingerprint(clean, senderPhone) : full.trim();
    if (seen.has(key)) {
      removed++;
      continue;
    }
    seen.add(key);
    kept.push(full.trimEnd());
  }
  if (removed > 0) {
    writeFileSync(ALL_CHATS_PATH, kept.join('\n') + '\n', 'utf8');
  }
  return { before: messages.length, after: kept.length, removed };
}
