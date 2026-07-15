'use client';

import { useEffect, useRef } from 'react';

declare global {
  interface Window {
    adsbygoogle?: unknown[];
  }
}

/**
 * Renders an HTML ad snippet and actually executes its <script> tags.
 * React's dangerouslySetInnerHTML does NOT run injected scripts, so network
 * ad units (AdSense Display, Adsterra Native Banner) would never load.
 *
 * For AdSense: skips reloading adsbygoogle.js when the sitewide loader is
 * already present, then ensures each unfilled <ins.adsbygoogle> is pushed.
 */
export function HtmlAdEmbed({ html, className }: { html: string; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = ref.current;
    if (!container || !html.trim()) return;

    container.innerHTML = html;

    const adsenseLoaderAlreadyPresent = Boolean(
      document.querySelector('script[src*="pagead2.googlesyndication.com/pagead/js/adsbygoogle.js"]')
    );

    const scripts = Array.from(container.querySelectorAll('script'));
    for (const oldScript of scripts) {
      const src = oldScript.getAttribute('src') || '';
      if (
        adsenseLoaderAlreadyPresent &&
        src.includes('pagead2.googlesyndication.com/pagead/js/adsbygoogle.js')
      ) {
        oldScript.remove();
        continue;
      }

      const newScript = document.createElement('script');
      for (const attr of Array.from(oldScript.attributes)) {
        newScript.setAttribute(attr.name, attr.value);
      }
      if (oldScript.textContent) newScript.textContent = oldScript.textContent;
      oldScript.parentNode?.replaceChild(newScript, oldScript);
    }

    const insNodes = Array.from(container.querySelectorAll('ins.adsbygoogle'));
    for (const ins of insNodes) {
      const status = ins.getAttribute('data-adsbygoogle-status');
      if (status === 'done' || status === 'filled') continue;
      try {
        (window.adsbygoogle = window.adsbygoogle || []).push({});
      } catch {
        // AdSense may throw if the unit was already initialized.
      }
    }

    return () => {
      container.innerHTML = '';
    };
  }, [html]);

  return <div ref={ref} className={className} />;
}
