export type BoostPackage = {
  id: 'starter' | 'pro' | 'premium';
  name: string;
  amount: number;
  days: number;
  featured: boolean;
  highlighted: boolean;
  mediaUploads: string;
  categorySelection: string;
  displayPlacement: string;
};

export const BOOST_PACKAGES: Record<BoostPackage['id'], BoostPackage> = {
  starter: {
    id: 'starter',
    name: 'Starter',
    amount: 5000,
    days: 7,
    featured: false,
    highlighted: false,
    mediaUploads: 'Up to 10 images + 1 video',
    categorySelection: 'Up to 2 categories',
    displayPlacement: 'Standard search visibility',
  },
  pro: {
    id: 'pro',
    name: 'Pro',
    amount: 9000,
    days: 14,
    featured: false,
    highlighted: true,
    mediaUploads: 'Up to 15 images + 3 videos',
    categorySelection: 'Up to 3 categories',
    displayPlacement: 'Highlighted in search results',
  },
  premium: {
    id: 'premium',
    name: 'Premium',
    amount: 18000,
    days: 30,
    featured: true,
    highlighted: true,
    mediaUploads: 'Up to 25 images + 5 videos',
    categorySelection: 'Up to 5 categories',
    displayPlacement: 'Homepage featured + highlighted search',
  },
};

