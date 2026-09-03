export type BoostPackage = {
  id: 'starter' | 'pro' | 'premium';
  name: string;
  amount: number;
  days: number;
  featured: boolean;
  highlighted: boolean;
  /** Post the listing to the Digit Properties Facebook Page after Boost Post Now. */
  socialFacebook: boolean;
  /** Post the listing to X after Boost Post Now. */
  socialTwitter: boolean;
  mediaUploads: string;
  categorySelection: string;
  displayPlacement: string;
  socialPosting: string;
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
    socialFacebook: false,
    socialTwitter: false,
    mediaUploads: 'Up to 10 images + 1 video',
    categorySelection: 'Up to 2 categories',
    displayPlacement: 'Standard search visibility',
    socialPosting: 'On-site boost only',
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
    socialFacebook: true,
    socialTwitter: false,
    mediaUploads: 'Up to 15 images + 3 videos',
    categorySelection: 'Up to 3 categories',
    displayPlacement: 'Highlighted in search results',
    socialPosting: 'Facebook Page posting',
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
    socialFacebook: true,
    socialTwitter: true,
    mediaUploads: 'Up to 25 images + 5 videos',
    categorySelection: 'Up to 5 categories',
    displayPlacement: 'Homepage featured + highlighted search',
    socialPosting: 'Facebook and X posting',
    visibilityIndex: 100,
    visibilityVsStarterMultiplier: 2.5,
    visibilityTier: 'Maximum',
  },
};

export type BoostSocialPlatform = 'facebook' | 'twitter' | 'both';

/** Platforms included in a boost package (null = on-site only). */
export function boostSocialPlatform(id: BoostPackage['id']): BoostSocialPlatform | null {
  const pkg = BOOST_PACKAGES[id];
  if (!pkg) return null;
  if (pkg.socialFacebook && pkg.socialTwitter) return 'both';
  if (pkg.socialFacebook) return 'facebook';
  if (pkg.socialTwitter) return 'twitter';
  return null;
}

/** Apply a paid (or admin-assigned) boost and reopen the media/edit prep window. */
export function listingBoostApplyUpdate(
  packageId: BoostPackage['id'],
  currentExpiresAt: Date | string | null | undefined,
  days?: number,
  now = new Date()
): {
  boostPackage: BoostPackage['id'];
  boostExpiresAt: Date;
  featured: boolean;
  highlighted: boolean;
  $unset: { boostPostedAt: 1 };
} {
  const pkg = BOOST_PACKAGES[packageId] ?? BOOST_PACKAGES.starter;
  const currentEnd = currentExpiresAt ? new Date(currentExpiresAt) : null;
  const base = currentEnd && !Number.isNaN(currentEnd.getTime()) && currentEnd > now ? currentEnd : now;
  const boostExpiresAt = new Date(base);
  boostExpiresAt.setDate(boostExpiresAt.getDate() + (days ?? pkg.days));
  return {
    boostPackage: pkg.id,
    boostExpiresAt,
    featured: pkg.featured,
    highlighted: pkg.highlighted,
    $unset: { boostPostedAt: 1 },
  };
}
