import Link from 'next/link';
import { ListingPackages } from '@/components/listings/ListingPackages';

export const metadata = {
  title: 'Subscription Plans | Digit Properties',
  description: 'Choose a listing plan: Guest/Free, Gold, or Premium. Upgrade for more listings, Featured and Highlighted spots.',
};

export default function SubscriptionPlansPage() {
  return (
    <div className="mx-auto max-w-5xl">
      <p className="mb-6">
        <Link href="/dashboard/payments" className="text-sm text-gray-600 hover:text-gray-900 underline">
          ← Payment history
        </Link>
      </p>
      <ListingPackages />
    </div>
  );
}
