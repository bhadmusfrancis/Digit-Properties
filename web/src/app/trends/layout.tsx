import type { Metadata } from 'next';
import { siteOrigin } from '@/lib/site-metadata';

const base = siteOrigin();

export const metadata: Metadata = {
  title: 'Trends & Insights',
  description:
    'Nigerian real estate news, market trends, events, and expert insights on property development, land titling, and documentation.',
  alternates: { canonical: `${base}/trends` },
  openGraph: {
    title: 'Trends & Insights | Digit Properties',
    description: 'Real estate news and market insights for Nigeria.',
    url: `${base}/trends`,
  },
};

export default function TrendsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
