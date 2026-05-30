'use client';

import { useEffect, useRef } from 'react';

/**
 * Renders an HTML ad snippet and actually executes its <script> tags.
 * React's dangerouslySetInnerHTML does NOT run injected scripts, so network
 * ad units like Adsterra's Native Banner (loader script + container div) would
 * never load. This re-creates each script node so the browser executes it.
 */
export function HtmlAdEmbed({ html, className }: { html: string; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = ref.current;
    if (!container) return;

    container.innerHTML = html;

    const scripts = Array.from(container.querySelectorAll('script'));
    for (const oldScript of scripts) {
      const newScript = document.createElement('script');
      for (const attr of Array.from(oldScript.attributes)) {
        newScript.setAttribute(attr.name, attr.value);
      }
      if (oldScript.textContent) newScript.textContent = oldScript.textContent;
      oldScript.parentNode?.replaceChild(newScript, oldScript);
    }

    return () => {
      container.innerHTML = '';
    };
  }, [html]);

  return <div ref={ref} className={className} />;
}
