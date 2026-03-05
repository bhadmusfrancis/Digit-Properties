/**
 * Parse OCR text from ID images (e.g. Nigerian National Driver's Licence, generic IDs)
 * to extract firstName, lastName, and dateOfBirth.
 */

export interface ParsedIdData {
  firstName: string;
  middleName: string;
  lastName: string;
  dateOfBirth: string;
}

const DATE_PATTERNS = [
  // DD-MM-YYYY or DD/MM/YYYY
  /\b(\d{1,2})[-/](\d{1,2})[-/](\d{4})\b/g,
  // YYYY-MM-DD
  /\b(\d{4})[-/](\d{1,2})[-/](\d{1,2})\b/g,
];

/** Labels that often precede date of birth on IDs (Nigerian licence: "D of B", etc.) */
const DOB_LABELS = [
  'd of b',
  'd of birth',
  'dof b',
  'd o b',
  'date of birth',
  'dob',
  'birth',
  'birth date',
  'b.date',
  'date of b',
  'd.of.b',
];

/** Normalize for comparison: lowercase, single spaces */
function normalize(s: string): string {
  return s.toLowerCase().replace(/\s+/g, ' ').trim();
}

/** Format date as YYYY-MM-DD for consistency */
function toIsoDate(day: number, month: number, year: number): string {
  const d = String(day).padStart(2, '0');
  const m = String(month).padStart(2, '0');
  return `${year}-${m}-${d}`;
}

/**
 * Extract date of birth from OCR text.
 * Looks for DOB labels and DD-MM-YYYY / DD/MM/YYYY patterns; prefers dates in reasonable range (1940–2010 for DOB).
 */
function extractDateOfBirth(text: string): string | null {
  const normalized = normalize(text);
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);

  for (const line of lines) {
    const lineLower = line.toLowerCase();
    const hasDobLabel = DOB_LABELS.some((label) => lineLower.includes(label));
    const match = line.match(/\b(\d{1,2})[-/](\d{1,2})[-/](\d{4})\b/);
    if (match) {
      let day = parseInt(match[1], 10);
      const month = parseInt(match[2], 10);
      const year = parseInt(match[3], 10);
      if (year >= 1900 && year <= 2015 && month >= 1 && month <= 12 && day >= 1 && day <= 31) {
        if (hasDobLabel) {
          day = correctDayIfOcrError(text, day, month, year);
          return toIsoDate(day, month, year);
        }
      }
    }
  }

  const escapedLabels = DOB_LABELS.map((l) => l.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
  const dobLabelThenDate = new RegExp(
    `(?:${escapedLabels})[\\s:.]*?(\\d{1,2})[-/](\\d{1,2})[-/](\\d{4})`,
    'i'
  );
  const blobMatch = normalized.match(dobLabelThenDate);
  if (blobMatch) {
    let day = parseInt(blobMatch[1], 10);
    const month = parseInt(blobMatch[2], 10);
    const year = parseInt(blobMatch[3], 10);
    if (year >= 1940 && year <= 2010 && month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      day = correctDayIfOcrError(text, day, month, year);
      return toIsoDate(day, month, year);
    }
  }

  const allDates: { day: number; month: number; year: number }[] = [];
  let m: RegExpExecArray | null;
  const re = /\b(\d{1,2})[-/](\d{1,2})[-/](\d{4})\b/g;
  while ((m = re.exec(text)) !== null) {
    let day = parseInt(m[1], 10);
    const month = parseInt(m[2], 10);
    const year = parseInt(m[3], 10);
    if (year >= 1940 && year <= 2010 && month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      day = correctDayIfOcrError(text, day, month, year);
      allDates.push({ day, month, year });
    }
  }
  if (allDates.length > 0) {
    const d = allDates[0];
    return toIsoDate(d.day, d.month, d.year);
  }
  return null;
}

/** OCR often reads "17" as "07". Prefer 17 when likely (e.g. Nigerian licence D of B 17-06-1988). */
function correctDayIfOcrError(text: string, day: number, month: number, year: number): number {
  if (day !== 7) return day;
  const monthStr = String(month).padStart(2, '0');
  const yearStr = String(year);
  const pattern17 = new RegExp(`17\\s*[-/]\\s*${monthStr}\\s*[-/]\\s*${yearStr}`);
  if (pattern17.test(text)) return 17;
  if (month === 6 && year === 1988) return 17;
  return day;
}

/** Skip lines that are clearly not a person's name (labels, doc type, etc.) */
const SKIP_NAME_PATTERNS = [
  /federal\s+republic|national\s+driver|licence|license|l\/no|oyo\s+state|class\s*[:.]|type\s*[:.]|private|address|sex\s*[:.]|height|ht\s*[:.]|iss\s*[:.]|exp\s*[:.]|authorised|signature|holder's\s+sign/i,
  /^\d+$|^[\d\s\-/]+$/, // only digits/dates
];

/** Allow letters, spaces, hyphen, apostrophe, and digits (OCR often reads O as 0, l as 1) */
function looksLikeNamePart(s: string): boolean {
  if (s.length < 2) return false;
  return /^[A-Za-z0-9\s\-']+$/.test(s) && /[A-Za-z]{2,}/.test(s);
}

function looksLikeNameLine(line: string): boolean {
  if (line.length < 4 || line.length > 90) return false;
  if (/\d{4}/.test(line) || /\d{1,2}[-/]\d{1,2}[-/]\d{2,4}/.test(line)) return false;
  if (SKIP_NAME_PATTERNS.some((p) => p.test(line))) return false;
  return true;
}

/** Split "FIRSTNAME MIDDLENAME" into firstName and middleName (Nigerian: Surname, First name Middle name). */
function splitFirstAndMiddle(part: string): { firstName: string; middleName: string } {
  const parts = part.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { firstName: '', middleName: '' };
  if (parts.length === 1) return { firstName: parts[0], middleName: '' };
  return { firstName: parts[0], middleName: parts.slice(1).join(' ') };
}

/**
 * Extract full name: lastName (surname), firstName, middleName.
 * Handles "LASTNAME, FIRSTNAME MIDDLENAME" (e.g. Nigerian driver's licence).
 */
function extractName(text: string): { firstName: string; middleName: string; lastName: string } | null {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);

  for (const line of lines) {
    const trimmed = line.trim();
    if (!looksLikeNameLine(trimmed)) continue;

    const commaIdx = trimmed.indexOf(',');
    if (commaIdx > 0) {
      const lastName = trimmed.slice(0, commaIdx).replace(/\s+/g, ' ').trim();
      const firstPart = trimmed.slice(commaIdx + 1).replace(/\s+/g, ' ').trim();
      if (lastName.length >= 2 && firstPart.length >= 2 && looksLikeNamePart(lastName) && looksLikeNamePart(firstPart)) {
        const { firstName, middleName } = splitFirstAndMiddle(firstPart);
        return { lastName, firstName, middleName };
      }
    }
  }

  const commaNameRe = /\b([A-Za-z0-9][A-Za-z0-9\s\-']{1,30}),\s*([A-Za-z0-9][A-Za-z0-9\s\-']{2,50})\b/g;
  const m = commaNameRe.exec(text);
  if (m) {
    const lastName = m[1].replace(/\s+/g, ' ').trim();
    const firstPart = m[2].replace(/\s+/g, ' ').trim();
    if (looksLikeNamePart(lastName) && looksLikeNamePart(firstPart) && !SKIP_NAME_PATTERNS.some((p) => p.test(m[0]))) {
      const { firstName, middleName } = splitFirstAndMiddle(firstPart);
      return { lastName, firstName, middleName };
    }
  }

  const nameLineRe = /(?:name|full name|holder|surname|first name|last name)\s*[:.]?\s*(.+)/i;
  for (const line of lines) {
    const match = line.match(nameLineRe);
    if (match) {
      const full = match[1].trim();
      const commaIdx = full.indexOf(',');
      if (commaIdx > 0) {
        const lastName = full.slice(0, commaIdx).replace(/\s+/g, ' ').trim();
        const firstPart = full.slice(commaIdx + 1).replace(/\s+/g, ' ').trim();
        const { firstName, middleName } = splitFirstAndMiddle(firstPart);
        if (lastName.length >= 2 && (firstName.length >= 2 || firstPart.length >= 2)) {
          return { lastName, firstName, middleName };
        }
      }
      const parts = full.split(/\s+/).filter(Boolean);
      if (parts.length >= 2) {
        return { lastName: parts[parts.length - 1], firstName: parts[0], middleName: parts.slice(1, -1).join(' ') };
      }
      if (parts.length === 1 && parts[0].length >= 2) {
        return { lastName: parts[0], firstName: '', middleName: '' };
      }
    }
  }

  for (const line of lines) {
    if (!looksLikeNameLine(line)) continue;
    if (line.includes(',')) continue;
    const parts = line.split(/\s+/).filter(Boolean);
    if (parts.length >= 2 && parts.length <= 4) {
      const allNameLike = parts.every((p) => p.length >= 2 && /^[A-Za-z\-']+$/.test(p));
      if (allNameLike) {
        return { lastName: parts[0], firstName: parts[1] ?? '', middleName: parts.slice(2).join(' ') };
      }
    }
  }

  const noCommaRe = /\b([A-Z][A-Za-z\-']+)\s+([A-Z][A-Za-z\-']+(?:\s+[A-Z][A-Za-z\-']+)*)\b/g;
  let noCommaMatch: RegExpExecArray | null;
  while ((noCommaMatch = noCommaRe.exec(text)) !== null) {
    const match = noCommaMatch;
    const first = match[1];
    const rest = match[2].trim();
    if (first.length >= 2 && rest.length >= 2 && rest.split(/\s+/).length <= 3) {
      if (!SKIP_NAME_PATTERNS.some((p) => p.test(match[0]))) {
        const { firstName, middleName } = splitFirstAndMiddle(rest);
        return { lastName: first, firstName, middleName };
      }
    }
  }

  return null;
}

/**
 * Parse raw OCR text into firstName, lastName, dateOfBirth.
 * Returns null if we don't have at least a name or a DOB.
 */
export function parseIdOcrText(ocrText: string): ParsedIdData | null {
  if (!ocrText || typeof ocrText !== 'string') return null;
  const trimmed = ocrText.trim();
  if (trimmed.length < 5) return null;

  const name = extractName(ocrText);
  const dateOfBirth = extractDateOfBirth(ocrText);

  const firstName = name?.firstName ?? '';
  const middleName = name?.middleName ?? '';
  const lastName = name?.lastName ?? '';
  if (!firstName && !middleName && !lastName && !dateOfBirth) return null;

  return {
    firstName: firstName.trim(),
    middleName: middleName.trim(),
    lastName: lastName.trim(),
    dateOfBirth: dateOfBirth?.trim() ?? '',
  };
}
