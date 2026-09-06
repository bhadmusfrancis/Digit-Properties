function esc(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function p(html: string): string {
  return `<p>${html}</p>`;
}

export function h2(text: string): string {
  return `<h2>${esc(text)}</h2>`;
}

export function h3(text: string): string {
  return `<h3>${esc(text)}</h3>`;
}

export function ul(items: string[]): string {
  return `<ul>${items.map((i) => `<li>${i}</li>`).join('')}</ul>`;
}

export function blockquote(html: string): string {
  return `<blockquote><p>${html}</p></blockquote>`;
}

export function extLink(url: string, label: string): string {
  return `<a href="${esc(url)}" target="_blank" rel="noopener noreferrer">${esc(label)}</a>`;
}

export function figure(src: string, caption: string, alt = ''): string {
  return `<figure><img src="${esc(src)}" alt="${esc(alt || caption)}" /><figcaption>${esc(caption)}</figcaption></figure>`;
}

export function normalizeBodyHtml(raw: string): string {
  let html = raw.trim();
  if (html.startsWith('```')) {
    html = html.replace(/^```(?:html)?\s*/i, '').replace(/\s*```$/, '');
  }
  return formatTrendArticleHtml(html);
}

/** Remove inline figures/images so the hero image is the only visual. */
export function stripInlineImages(html: string): string {
  return html
    .replace(/<figure\b[^>]*>[\s\S]*?<\/figure>/gi, '')
    .replace(/<img\b[^>]*>/gi, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function hasBlockHtml(html: string): boolean {
  return /<(p|h[1-6]|ul|ol|li|blockquote|div|section)\b/i.test(html);
}

function isNoiseLine(line: string): boolean {
  const t = line.trim();
  if (!t) return true;
  if (/^(TITLE|EXCERPT)\s*:/i.test(t)) return true;
  if (/^sources?\s*:?\s*$/i.test(t)) return true;
  if (/—\s*source imagery$/i.test(t)) return true;
  if (/^source imagery$/i.test(t)) return true;
  if (/^[-–—•*]{1,3}$/.test(t)) return true;
  return false;
}

function looksLikeHeading(line: string): boolean {
  const t = line.trim();
  if (t.length < 8 || t.length > 90) return false;
  if (/[.?!]$/.test(t)) return false;
  if (/^(note|sources?)\b/i.test(t)) return false;
  const words = t.split(/\s+/);
  if (words.length > 14) return false;
  // Title Case / short section labels (allow leading The/A/An)
  const contentWords = words.filter((w) => !/^(of|and|the|in|for|to|a|an|on|with|&|–|-)$/i.test(w.replace(/:$/, '')));
  const titleish = contentWords.filter((w) => /^[A-Z0-9“"]/.test(w)).length;
  if (contentWords.length > 0 && titleish / contentWords.length >= 0.7) return true;
  if (/^[A-Z][A-Za-z0-9 &'–,:-]+:$/.test(t) && t.length <= 60) return true;
  return false;
}

function looksLikeBullet(line: string): boolean {
  const t = line.trim();
  if (/^(?:[-–—•*]|\d+[.)])\s+\S/.test(t)) return true;
  // "Short Label: practical tip…" — not a full Title-Case section heading
  const colon = t.match(/^([^:]{2,42}):\s+(\S.+)$/);
  if (!colon) return false;
  const labelWords = colon[1].trim().split(/\s+/);
  if (labelWords.length === 0 || labelWords.length > 5) return false;
  if (colon[2].length < 24) return false;
  // If the whole line looks like a section heading, prefer heading.
  if (looksLikeHeading(t)) return false;
  return true;
}

function looksLikeQuote(line: string): boolean {
  const t = line.trim();
  return /^["“]/.test(t) && t.length > 40;
}

function bulletText(line: string): string {
  return line
    .trim()
    .replace(/^(?:[-–—•*]|\d+[.)])\s+/, '')
    .trim();
}

function plainTextToHtml(raw: string): string {
  const lines = raw
    .replace(/\r\n/g, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .split('\n')
    .map((l) => l.replace(/\s+/g, ' ').trim())
    .filter((l) => !isNoiseLine(l));

  const blocks: string[] = [];
  let i = 0;
  let skippedLeadTitle = false;

  while (i < lines.length) {
    const line = lines[i];

    // Drop a duplicated lead title if it matches the first substantive heading-like line.
    if (!skippedLeadTitle && looksLikeHeading(line) && i === 0) {
      skippedLeadTitle = true;
      // Keep as h2 only if the next line isn't another heading/excerpt-like lead.
      if (i + 1 < lines.length && !looksLikeHeading(lines[i + 1]) && lines[i + 1].length > 80) {
        blocks.push(h2(line));
        i += 1;
        continue;
      }
      i += 1;
      continue;
    }

    if (looksLikeQuote(line)) {
      const q = line.trim().replace(/^["“]/, '');
      const end = q.search(/["”]/);
      const quoted = end >= 0 ? q.slice(0, end).trim() : q.replace(/["”].*$/, '').trim();
      const rest = end >= 0 ? q.slice(end + 1).trim().replace(/^[,.\s]+/, '') : '';
      const body = rest ? `${esc(quoted)} <cite>${esc(rest)}</cite>` : esc(quoted);
      blocks.push(`<blockquote><p>${body}</p></blockquote>`);
      i += 1;
      continue;
    }

    if (looksLikeHeading(line)) {
      blocks.push(h2(line));
      i += 1;
      continue;
    }

    if (looksLikeBullet(line)) {
      const items: string[] = [];
      while (i < lines.length && looksLikeBullet(lines[i])) {
        items.push(esc(bulletText(lines[i])));
        i += 1;
      }
      blocks.push(ul(items));
      continue;
    }

    // Merge consecutive short prose lines into one paragraph until blank/heading/bullet.
    const para: string[] = [line];
    i += 1;
    while (i < lines.length) {
      const next = lines[i];
      if (looksLikeHeading(next) || looksLikeBullet(next) || looksLikeQuote(next)) break;
      // Start a new paragraph on clear sentence breaks when line is long.
      if (para.join(' ').length > 420 && /^[A-Z]/.test(next) && /\.$/.test(para[para.length - 1] || '')) break;
      para.push(next);
      i += 1;
      if (para.join(' ').length > 700) break;
    }
    blocks.push(p(esc(para.join(' '))));
  }

  return blocks.join('\n');
}

function tidyExistingHtml(html: string): string {
  return stripInlineImages(html)
    .replace(/<\/?(?:title|excerpt)\b[^>]*>/gi, '')
    .replace(/<h1[^>]*>([\s\S]*?)<\/h1>/gi, '')
    .replace(/<p>\s*(?:&nbsp;|\s|<br\s*\/?\s*>)*\s*<\/p>/gi, '')
    .replace(/(?:<br\s*\/?\s*>\s*){2,}/gi, '</p><p>')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * Turn raw model output or legacy plain-text posts into clean article HTML.
 * Safe to run on every render — idempotent for already-good HTML.
 */
export function formatTrendArticleHtml(raw: string): string {
  if (!raw?.trim()) return '';
  let text = raw.trim();
  if (text.startsWith('```')) {
    text = text.replace(/^```(?:html)?\s*/i, '').replace(/\s*```$/, '').trim();
  }

  // Strip leaked TITLE/EXCERPT lines anywhere near the top.
  text = text
    .replace(/^\s*TITLE:\s*[^\n]*\n?/i, '')
    .replace(/^\s*EXCERPT:\s*[^\n]*\n?/i, '')
    .replace(/<\/?(?:title|excerpt)\b[^>]*>/gi, '')
    .replace(/<h[12]>\s*(?:TITLE|EXCERPT)\s*:?\s*[^<]*<\/h[12]>/gi, '')
    .trim();

  if (!hasBlockHtml(text)) {
    return plainTextToHtml(text);
  }

  return tidyExistingHtml(text);
}

export { esc };
