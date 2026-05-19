import type { Metadata } from 'next';
import { siteOrigin } from '@/lib/site-metadata';

const base = siteOrigin();

export const metadata: Metadata = {
  title: 'Property Listings',
  description:
    'Search apartments, houses, land, and commercial properties for sale and rent across Nigeria. Filter by location, price, and property type.',
  alternates: { canonical: `${base}/listings` },
  openGraph: {
    title: 'Property Listings | Digit Properties',
    description:
      'Browse Nigerian properties for sale and rent. Filter by city, state, price, and property type.',
    url: `${base}/listings`,
  },
};

export default function ListingsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
