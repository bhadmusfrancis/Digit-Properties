import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);
  if (!session) redirect('/auth/signin?callbackUrl=/dashboard');

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="flex flex-col gap-8 lg:flex-row">
        <aside className="w-full lg:w-64 shrink-0">
          <nav className="space-y-1 rounded-lg border border-gray-200 bg-white p-4">
            <Link
              href="/dashboard"
              className="block rounded-md px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100"
            >
              Overview
            </Link>
            <Link
              href="/dashboard/listings"
              className="block rounded-md px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100"
            >
              My Listings
            </Link>
            <Link
              href="/dashboard/alerts"
              className="block rounded-md px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100"
            >
              Saved Searches
            </Link>
            <Link
              href="/dashboard/saved"
              className="block rounded-md px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100"
            >
              Saved Listings
            </Link>
            <Link
              href="/dashboard/claims"
              className="block rounded-md px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100"
            >
              My Claims
            </Link>
            <Link
              href="/dashboard/payments"
              className="block rounded-md px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100"
            >
              Payments
            </Link>
          </nav>
        </aside>
        <main className="flex-1">{children}</main>
      </div>
    </div>
  );
}
