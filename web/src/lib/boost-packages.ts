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
  /**
   * 0–100 comparative visibility score for UI (Premium = 100).
   * Factored from: active boost window, highlighted / featured discovery, media & category caps.
   * This is a plan model for comparison — not measured impressions or CTR.
   */
  visibilityIndex: number;
  /**
   * Approximate relative exposure vs Starter for the same listing quality (estimate only).
   */
  visibilityVsStarterMultiplier: number;
  /** Short tier label for badges. */
  visibilityTier: 'Standard' | 'High' | 'Maximum';
};

/**
 * Shown near boost pricing so users know scores are plan-based estimates, not analytics.
 */
export const BOOST_VISIBILITY_DISCLAIMER =
  'Visibility scores compare plan features (placement, duration, limits), not live view counts.';

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
    visibilityIndex: 40,
    visibilityVsStarterMultiplier: 1,
    visibilityTier: 'Standard',
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
    visibilityIndex: 72,
    visibilityVsStarterMultiplier: 1.8,
    visibilityTier: 'High',
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
    visibilityIndex: 100,
    visibilityVsStarterMultiplier: 2.5,
    visibilityTier: 'Maximum',
  },
};
