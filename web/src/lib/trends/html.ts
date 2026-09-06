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
  return html.trim();
}

/** Remove inline figures/images so the hero image is the only visual. */
export function stripInlineImages(html: string): string {
  return html
    .replace(/<figure\b[^>]*>[\s\S]*?<\/figure>/gi, '')
    .replace(/<img\b[^>]*>/gi, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export { esc };
