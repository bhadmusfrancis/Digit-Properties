import { USER_ROLES } from '@/lib/constants';

const BADGE_LABELS: Record<string, string> = {
  [USER_ROLES.VERIFIED_INDIVIDUAL]: 'Verified Individual',
  [USER_ROLES.REGISTERED_AGENT]: 'Registered Agent',
  [USER_ROLES.REGISTERED_DEVELOPER]: 'Registered Developer',
  [USER_ROLES.ADMIN]: 'Admin',
};

export function Badge({ role }: { role: string }) {
  const label = BADGE_LABELS[role];
  if (!label) return null;

  return (
    <span className="inline-flex items-center rounded-full bg-primary-100 px-2 py-0.5 text-xs font-medium text-primary-800">
      {label}
    </span>
  );
}
