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
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-8 flex items-center justify-between border-b border-gray-200 pb-4">
        <h1 className="text-xl font-bold text-gray-900">Admin</h1>
        <Link href="/dashboard" className="text-sm text-gray-600 hover:underline">
          Back to Dashboard
        </Link>
      </div>
      <nav className="mb-8 flex gap-4">
        <Link href="/admin" className="text-gray-700 hover:text-primary-600">
          Overview
        </Link>
        <Link href="/admin/users" className="text-gray-700 hover:text-primary-600">
          Users
        </Link>
        <Link href="/admin/claims" className="text-gray-700 hover:text-primary-600">
          Claims
        </Link>
        <Link href="/admin/listings" className="text-gray-700 hover:text-primary-600">
          Listings
        </Link>
        <Link href="/admin/config" className="text-gray-700 hover:text-primary-600">
          Subscription config
        </Link>
        <Link href="/admin/emails" className="text-gray-700 hover:text-primary-600">
          Email templates
        </Link>
      </nav>
      <main>{children}</main>
    </div>
  );
}
