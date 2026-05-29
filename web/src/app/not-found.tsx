import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Page not found',
  robots: { index: false, follow: true },
};

export default function NotFound() {
  return (
    <div className="mx-auto flex max-w-2xl flex-col items-center px-4 py-20 text-center">
      <p className="text-sm font-semibold uppercase tracking-wide text-primary-600">404</p>
      <h1 className="mt-2 text-3xl font-bold text-gray-900 sm:text-4xl">Page not found</h1>
      <p className="mt-4 text-gray-600">
        The page you are looking for doesn&apos;t exist or may have been moved. The listing might
        also have been removed or is no longer available.
      </p>
      <div className="mt-8 flex flex-wrap justify-center gap-4">
        <Link href="/" className="btn-secondary">
          Go home
        </Link>
        <Link href="/listings" className="btn-primary">
          Browse listings
        </Link>
      </div>
    </div>
  );
}
