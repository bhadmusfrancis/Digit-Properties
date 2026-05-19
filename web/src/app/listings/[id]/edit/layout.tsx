import type { Metadata } from 'next';

export const metadata: Metadata = {
  robots: { index: false, follow: false },
  title: 'Edit Listing',
};

export default function EditListingLayout({ children }: { children: React.ReactNode }) {
  return children;
}
