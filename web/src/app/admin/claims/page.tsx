import { dbConnect } from '@/lib/db';
import Claim from '@/models/Claim';
import Link from 'next/link';
import { ClaimApproveButton } from './ClaimApproveButton';

export default async function AdminClaimsPage() {
  await dbConnect();
  const claims = await Claim.find({ status: 'pending' })
    .populate('listingId', 'title')
    .populate('userId', 'name email')
    .sort({ createdAt: -1 })
    .lean();

  return (
    <div>
      <h2 className="text-lg font-semibold text-gray-900">Pending Claims</h2>
      <div className="mt-4 overflow-hidden rounded-lg border border-gray-200 bg-white">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Listing</th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Claimant</th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Date</th>
              <th className="px-4 py-3 text-right text-xs font-medium uppercase text-gray-500">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {claims.map((c) => (
              <tr key={c._id.toString()}>
                <td className="px-4 py-3">
                  <Link
                    href={`/listings/${String(typeof c.listingId === 'object' && c.listingId && '_id' in c.listingId ? (c.listingId as { _id: unknown })._id : c.listingId)}`}
                    className="text-primary-600 hover:underline"
                  >
                    {(c.listingId as { title?: string })?.title || '—'}
                  </Link>
                </td>
                <td className="px-4 py-3 text-sm">
                  {(c.userId as { name?: string })?.name} ({(c.userId as { email?: string })?.email})
                </td>
                <td className="px-4 py-3 text-sm text-gray-600">
                  {new Date(c.createdAt).toLocaleDateString('en-NG')}
                </td>
                <td className="px-4 py-3 text-right">
                  <ClaimApproveButton claimId={c._id.toString()} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {claims.length === 0 && (
          <div className="py-12 text-center text-gray-500">No pending claims.</div>
        )}
      </div>
    </div>
  );
}
