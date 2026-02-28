import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { USER_ROLES } from '@/lib/constants';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);
  if (!session || session.user?.role !== USER_ROLES.ADMIN) {
    redirect('/auth/signin?callbackUrl=/admin');
  }

  return (
    <div className="mx-auto max-w-7xl px-3 py-4 sm:px-6 sm:py-8 lg:px-8">
      <div className="mb-4 flex flex-col gap-2 border-b border-gray-200 pb-4 sm:mb-8 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-lg font-bold text-gray-900 sm:text-xl">Admin</h1>
        <Link href="/dashboard" className="text-sm text-gray-600 hover:underline">
          Back to Dashboard
        </Link>
      </div>
      <nav className="mb-6 flex flex-wrap gap-2 overflow-x-auto pb-2 sm:mb-8 sm:gap-4 sm:overflow-visible sm:pb-0">
        <Link href="/admin" className="whitespace-nowrap rounded-md px-2 py-1.5 text-sm text-gray-700 hover:bg-gray-100 hover:text-primary-600 sm:px-0 sm:py-0 sm:bg-transparent">
          Overview
        </Link>
        <Link href="/admin/users" className="whitespace-nowrap rounded-md px-2 py-1.5 text-sm text-gray-700 hover:bg-gray-100 hover:text-primary-600 sm:px-0 sm:py-0 sm:bg-transparent">
          Users
        </Link>
        <Link href="/admin/claims" className="whitespace-nowrap rounded-md px-2 py-1.5 text-sm text-gray-700 hover:bg-gray-100 hover:text-primary-600 sm:px-0 sm:py-0 sm:bg-transparent">
          Claims
        </Link>
        <Link href="/admin/listings" className="whitespace-nowrap rounded-md px-2 py-1.5 text-sm text-gray-700 hover:bg-gray-100 hover:text-primary-600 sm:px-0 sm:py-0 sm:bg-transparent">
          Listings
        </Link>
        <Link href="/admin/config" className="whitespace-nowrap rounded-md px-2 py-1.5 text-sm text-gray-700 hover:bg-gray-100 hover:text-primary-600 sm:px-0 sm:py-0 sm:bg-transparent">
          Subscription config
        </Link>
        <Link href="/admin/emails" className="whitespace-nowrap rounded-md px-2 py-1.5 text-sm text-gray-700 hover:bg-gray-100 hover:text-primary-600 sm:px-0 sm:py-0 sm:bg-transparent">
          Email templates
        </Link>
        <Link href="/admin/trends" className="whitespace-nowrap rounded-md px-2 py-1.5 text-sm text-gray-700 hover:bg-gray-100 hover:text-primary-600 sm:px-0 sm:py-0 sm:bg-transparent">
          Trends
        </Link>
      </nav>
      <main className="min-w-0">{children}</main>
    </div>
  );
}
