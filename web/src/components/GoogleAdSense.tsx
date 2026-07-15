import Script from 'next/script';
import { ADSENSE_PUBLISHER_ID } from '@/lib/site-contact';

const clientId =
  process.env.NEXT_PUBLIC_ADSENSE_PUBLISHER_ID?.trim() || ADSENSE_PUBLISHER_ID;

/** Sitewide AdSense loader (Auto ads + manual units). Publisher: ca-pub-… */
export function GoogleAdSense() {
  const client = clientId.startsWith('ca-') ? clientId : `ca-${clientId}`;

  return (
    <Script
      id="google-adsense"
      async
      src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${client}`}
      crossOrigin="anonymous"
      strategy="afterInteractive"
    />
  );
}
