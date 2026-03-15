import path from 'path';
import os from 'os';
import fs from 'fs';
import { NextResponse } from 'next/server';
import { createWorker, PSM } from 'tesseract.js';
import sharp from 'sharp';
import { getSession } from '@/lib/get-session';
import { parseIdOcrText } from '@/lib/id-ocr';

/** Allow up to 90s so OCR can complete (Vercel etc. may limit by default). */
export const maxDuration = 90;

const ALLOWED = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_SIZE = 10 * 1024 * 1024; // 10MB
const OCR_MAX_WIDTH = 1600;
/** Tesseract needs text ~10–20px x-height; ensure short side at least this so ID text is readable. */
const OCR_MIN_SHORT_SIDE = 600;
/** Max time for OCR so the request does not hang (Tesseract can be slow on first run). */
const OCR_TIMEOUT_MS = 85_000;

const MIME_EXT: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
};

/** Ensure image has minimum size for OCR (Tesseract needs text ~10–20px height). Upscale if too small. */
async function ensureMinResolution(buffer: Buffer): Promise<Buffer> {
  try {
    const meta = await sharp(buffer).metadata();
    const w = meta.width ?? 0;
    const h = meta.height ?? 0;
    const short = Math.min(w, h);
    if (short >= OCR_MIN_SHORT_SIDE || short === 0) return buffer;
    const scale = OCR_MIN_SHORT_SIDE / short;
    const newW = Math.round(w * scale);
    const newH = Math.round(h * scale);
    return await sharp(buffer).resize(newW, newH).toBuffer();
  } catch {
    return buffer;
  }
}

/** Preprocess for OCR: normalize size (upscale if small), grayscale, normalize contrast, sharpen. Optional rotate. */
async function preprocessForOcr(buffer: Buffer, rotate?: number): Promise<Buffer | null> {
  try {
    const withResolution = await ensureMinResolution(buffer);
    let pipeline = sharp(withResolution).resize(OCR_MAX_WIDTH, undefined, {
      fit: 'inside',
      withoutEnlargement: true,
    });
    if (rotate && (rotate === 90 || rotate === 180 || rotate === 270)) {
      pipeline = pipeline.rotate(rotate);
    }
    return await pipeline
      .grayscale()
      .normalize()
      .sharpen()
      .png()
      .toBuffer();
  } catch {
    return null;
  }
}

/** Binarized (black/white) version for low-contrast or faint ID text. */
async function preprocessBinarized(buffer: Buffer): Promise<Buffer | null> {
  try {
    const withResolution = await ensureMinResolution(buffer);
    return await sharp(withResolution)
      .resize(OCR_MAX_WIDTH, undefined, { fit: 'inside', withoutEnlargement: true })
      .grayscale()
      .normalize()
      .threshold(128)
      .png()
      .toBuffer();
  } catch {
    return null;
  }
}

/** Resolve tesseract.js worker script to a real filesystem absolute path (required by Node Worker). */
function getTesseractWorkerPath(): string {
  const candidates = [
    path.resolve(process.cwd(), 'node_modules', 'tesseract.js', 'src', 'worker-script', 'node', 'index.js'),
    path.resolve(process.cwd(), '..', 'node_modules', 'tesseract.js', 'src', 'worker-script', 'node', 'index.js'),
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  return candidates[0];
}

function normalizeOcrText(raw: string): string {
  return raw
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]+/g, ' ')
    .trim();
}

/** Run OCR on image; use temp file path so Tesseract worker can read reliably. Tries SINGLE_BLOCK first (fastest for ID cards), then others. */
async function runIdOcr(
  buffer: Buffer,
  mimeType: string
): Promise<{ parsed: { firstName: string; middleName: string; lastName: string; dateOfBirth: string; expiryDate: string } | null; rawText: string }> {
  const ext = MIME_EXT[mimeType] || '.jpg';
  const tmpPath = path.join(os.tmpdir(), `id-ocr-${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`);
  let worker;
  let bestRaw = '';
  let bestParsed: { firstName: string; middleName: string; lastName: string; dateOfBirth: string; expiryDate: string } | null = null;
  try {
    await fs.promises.writeFile(tmpPath, buffer);
    worker = await createWorker('eng', 1, {
      logger: () => {},
      workerPath: getTesseractWorkerPath(),
    });
    // SINGLE_BLOCK and AUTO are best for ID-style blocks; SPARSE_TEXT as fallback.
    const psms = [PSM.SINGLE_BLOCK, PSM.AUTO, PSM.SPARSE_TEXT];
    for (const psm of psms) {
      await worker.setParameters({ tessedit_pageseg_mode: psm });
      const { data } = await worker.recognize(tmpPath);
      const raw = data?.text ?? '';
      if (raw.length > bestRaw.length) bestRaw = raw;
      const text = normalizeOcrText(raw);
      const parsed = parseIdOcrText(text);
      if (parsed && (parsed.firstName || parsed.middleName || parsed.lastName || parsed.dateOfBirth || parsed.expiryDate)) {
        await worker.terminate();
        await fs.promises.unlink(tmpPath).catch(() => {});
        return { parsed, rawText: raw };
      }
      if (parsed) bestParsed = parsed;
    }
    await worker.terminate();
    if (process.env.NODE_ENV !== 'production' && bestRaw.length < 50) {
      console.warn('[id-upload] OCR returned little or no text. Length:', bestRaw.length, 'Preview:', bestRaw.slice(0, 200));
    }
    return { parsed: bestParsed, rawText: bestRaw };
  } catch (e) {
    if (worker) await worker.terminate().catch(() => {});
    console.error('[id-upload] OCR error:', e);
    return { parsed: null, rawText: '' };
  } finally {
    await fs.promises.unlink(tmpPath).catch(() => {});
  }
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('OCR_TIMEOUT')), ms);
    promise.then(
      (v) => {
        clearTimeout(t);
        resolve(v);
      },
      (err) => {
        clearTimeout(t);
        reject(err);
      }
    );
  });
}

/**
 * Process ID front image only: OCR runs on the FRONT of the ID (name, DOB, etc.).
 * Does NOT upload to Cloudinary or save to User. idBack is not used for detection.
 * Documents are uploaded and saved only when the user completes Step 2 (Confirm or Consent).
 */
export async function POST(req: Request) {
  try {
    const session = await getSession(req);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const formData = await req.formData();
    const idFront = formData.get('idFront') as File | null;
    const ocrTextFromClient = formData.get('ocrText');
    // Detection uses only the front image; idBack is sent by the client but not used for OCR here
    if (!idFront || !(idFront instanceof File) || idFront.size === 0) {
      return NextResponse.json({ error: 'Upload ID front image (file required, no links).' }, { status: 400 });
    }
    if (!ALLOWED.includes(idFront.type)) {
      return NextResponse.json({ error: 'ID front must be JPEG, PNG or WebP.' }, { status: 400 });
    }
    if (idFront.size > MAX_SIZE) {
      return NextResponse.json({ error: 'ID front image max 10MB.' }, { status: 400 });
    }

    // If client sent OCR text (browser Tesseract), parse it and skip server OCR (avoids Node worker/path issues).
    if (typeof ocrTextFromClient === 'string' && ocrTextFromClient.trim().length > 0) {
      const parsed = parseIdOcrText(ocrTextFromClient.trim());
      const scanned = parsed && (parsed.firstName || parsed.middleName || parsed.lastName || parsed.dateOfBirth || parsed.expiryDate)
        ? parsed
        : null;
      const rawOcrPreview = ocrTextFromClient.replace(/\s+/g, ' ').trim().slice(0, 800);
      return NextResponse.json({ scanned, rawOcrPreview });
    }

    const frontBytes = await idFront.arrayBuffer();
    const frontBuffer = Buffer.from(frontBytes);
    const mimeType = idFront.type || 'image/jpeg';

    const runOcr = async (): Promise<{ parsed: { firstName: string; middleName: string; lastName: string; dateOfBirth: string; expiryDate: string } | null; rawText: string }> => {
      // OCR runs on the ID FRONT only. Try multiple pipelines: preprocessed (grayscale+sharpen), binarized, raw, then rotations.
      let best = { parsed: null as { firstName: string; middleName: string; lastName: string; dateOfBirth: string; expiryDate: string } | null, rawText: '' };
      const hasUsableParsed = (p: typeof best.parsed) =>
        p && (p.firstName || p.middleName || p.lastName || p.dateOfBirth || p.expiryDate);
      const tryResult = (res: { parsed: typeof best.parsed; rawText: string }) => {
        if (hasUsableParsed(res.parsed)) return res;
        if (res.rawText.length > best.rawText.length) best = { ...best, rawText: res.rawText };
        if (res.parsed) best = { ...best, parsed: res.parsed };
      };

      const preprocessed = await preprocessForOcr(frontBuffer);
      if (preprocessed) {
        tryResult(await runIdOcr(preprocessed, 'image/png'));
        if (hasUsableParsed(best.parsed)) return best;
      }
      const binarized = await preprocessBinarized(frontBuffer);
      if (binarized) {
        tryResult(await runIdOcr(binarized, 'image/png'));
        if (hasUsableParsed(best.parsed)) return best;
      }
      tryResult(await runIdOcr(frontBuffer, mimeType));
      if (hasUsableParsed(best.parsed)) return best;
      if (best.rawText.length < 30 && preprocessed) {
        for (const rot of [90, 270] as const) {
          const rotated = await preprocessForOcr(frontBuffer, rot);
          if (!rotated) continue;
          tryResult(await runIdOcr(rotated, 'image/png'));
          if (hasUsableParsed(best.parsed)) return best;
        }
      }
      return best;
    };

    let result;
    try {
      result = await withTimeout(runOcr(), OCR_TIMEOUT_MS);
    } catch (e) {
      if (e instanceof Error && e.message === 'OCR_TIMEOUT') {
        console.warn('[id-upload] OCR timed out');
        return NextResponse.json({
          scanned: null,
          rawOcrPreview: undefined,
          error: 'Scanning timed out. Try a smaller or clearer image and try again.',
        }, { status: 200 });
      }
      throw e;
    }

    const scanned = result.parsed?.firstName || result.parsed?.middleName || result.parsed?.lastName || result.parsed?.dateOfBirth || result.parsed?.expiryDate
      ? result.parsed
      : null;
    const rawOcrPreview = result.rawText
      ? result.rawText.replace(/\s+/g, ' ').trim().slice(0, 800)
      : undefined;

    return NextResponse.json({ scanned, rawOcrPreview });
  } catch (e) {
    console.error('[id-upload]', e);
    return NextResponse.json({ error: 'Processing failed' }, { status: 500 });
  }
}
