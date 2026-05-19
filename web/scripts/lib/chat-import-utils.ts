import { createHash } from 'crypto';
import { existsSync, statSync } from 'fs';
import path from 'path';

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
  const m = full.match(
    /^\[([^\]]+)\]\s+~\s+([^~]+)\s+~\s+\(([^)]*)\):\s*([\s\S]*)$/
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
