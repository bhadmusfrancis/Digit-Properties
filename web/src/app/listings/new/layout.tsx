import type { Metadata } from 'next';

export const metadata: Metadata = {
  robots: { index: false, follow: false },
  title: 'Post a Listing',
};

export default function NewListingLayout({ children }: { children: React.ReactNode }) {
  return children;
}
