import type { Metadata } from 'next';
import { siteOrigin } from '@/lib/site-metadata';

const base = siteOrigin();

export const metadata: Metadata = {
  title: 'Contact Us',
  description:
    'Contact Digit Properties for help with listings, verification, land titling, development documentation, or general enquiries.',
  alternates: { canonical: `${base}/contact` },
  openGraph: {
    title: 'Contact Us | Digit Properties',
    description: 'Get in touch with the Digit Properties team.',
    url: `${base}/contact`,
  },
};

export default function ContactLayout({ children }: { children: React.ReactNode }) {
  return children;
}
