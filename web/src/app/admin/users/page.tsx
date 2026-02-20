import { dbConnect } from '@/lib/db';
import User from '@/models/User';
import Link from 'next/link';

export default async function AdminUsersPage() {
  await dbConnect();
  const users = await User.find({}).sort({ createdAt: -1 }).limit(200).lean();

  return (
    <div>
      <h2 className="text-lg font-semibold text-gray-900">Users</h2>
      <p className="mt-1 text-sm text-gray-500">{users.length} users (max 200 shown)</p>
      <div className="mt-4 overflow-hidden rounded-lg border border-gray-200 bg-white">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Name</th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Email</th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Role</th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Joined</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 bg-white">
            {users.map((u) => (
              <tr key={String(u._id)}>
                <td className="px-4 py-3 text-sm font-medium text-gray-900">{u.name}</td>
                <td className="px-4 py-3 text-sm text-gray-600">{u.email}</td>
                <td className="px-4 py-3">
                  <span className="inline-flex rounded-full bg-gray-100 px-2 py-1 text-xs font-medium text-gray-800">
                    {u.role}
                  </span>
                </td>
                <td className="px-4 py-3 text-sm text-gray-600">
                  {u.createdAt ? new Date(u.createdAt).toLocaleDateString('en-NG') : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {users.length === 0 && (
          <div className="py-12 text-center text-gray-500">No users yet.</div>
        )}
      </div>
      <p className="mt-4">
        <Link href="/admin" className="text-sm text-primary-600 hover:underline">← Back to Admin</Link>
      </p>
    </div>
  );
}
