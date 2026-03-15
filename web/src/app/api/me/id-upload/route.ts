import path from 'path';
import os from 'os';
import fs from 'fs';
import { NextResponse } from 'next/server';
import { createWorker, PSM } from 'tesseract.js';
import sharp from 'sharp';
import { getSession } from '@/lib/get-session';
import { parseIdOcrText } from '@/lib/id-ocr';

/** Allow up to 60s so OCR can complete (Vercel etc. may limit by default). */
export const maxDuration = 60;

const ALLOWED = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_SIZE = 10 * 1024 * 1024; // 10MB
const OCR_MAX_WIDTH = 1600;
/** Max time for OCR so the request does not hang (Tesseract can be slow on first run). */
const OCR_TIMEOUT_MS = 55_000;

const MIME_EXT: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
};

/** Preprocess image for better OCR: resize, grayscale, normalize contrast. Returns PNG buffer or null on failure. */
async function preprocessForOcr(buffer: Buffer): Promise<Buffer | null> {
  try {
    return await sharp(buffer)
      .resize(OCR_MAX_WIDTH, undefined, { fit: 'inside', withoutEnlargement: true })
      .grayscale()
      .normalize()
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

/** Run OCR on image; use temp file path so Tesseract worker can read reliably. */
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
    const psms = [PSM.AUTO, PSM.SINGLE_BLOCK, PSM.SPARSE_TEXT];
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
 * Process ID front image: OCR only. Does NOT upload to Cloudinary or save to User.
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

    if (!idFront || !(idFront instanceof File) || idFront.size === 0) {
      return NextResponse.json({ error: 'Upload ID front image (file required, no links).' }, { status: 400 });
    }
    if (!ALLOWED.includes(idFront.type)) {
      return NextResponse.json({ error: 'ID front must be JPEG, PNG or WebP.' }, { status: 400 });
    }
    if (idFront.size > MAX_SIZE) {
      return NextResponse.json({ error: 'ID front image max 10MB.' }, { status: 400 });
    }

    const frontBytes = await idFront.arrayBuffer();
    const frontBuffer = Buffer.from(frontBytes);
    const mimeType = idFront.type || 'image/jpeg';

    const runOcr = async () => {
      let result = await runIdOcr(frontBuffer, mimeType);
      if (!result.parsed?.firstName && !result.parsed?.middleName && !result.parsed?.lastName && !result.parsed?.dateOfBirth) {
        const preprocessed = await preprocessForOcr(frontBuffer);
        if (preprocessed) {
          const fallback = await runIdOcr(preprocessed, 'image/png');
          if (fallback.parsed && (fallback.parsed.firstName || fallback.parsed.middleName || fallback.parsed.lastName || fallback.parsed.dateOfBirth)) {
            result = fallback;
          } else if (fallback.rawText.length > result.rawText.length) {
            result = fallback;
          }
        }
      }
      return result;
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
    const rawOcrPreview = !scanned && result.rawText
      ? result.rawText.replace(/\s+/g, ' ').trim().slice(0, 800)
      : undefined;

    return NextResponse.json({ scanned, rawOcrPreview });
  } catch (e) {
    console.error('[id-upload]', e);
    return NextResponse.json({ error: 'Processing failed' }, { status: 500 });
  }
}
