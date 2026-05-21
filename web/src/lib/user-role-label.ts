/** Human-readable label for a user role slug. */
export function formatUserRoleLabel(role: string | undefined | null): string {
  const r = (role || '').toLowerCase();
  const labels: Record<string, string> = {
    guest: 'Guest account',
    verified_individual: 'Verified individual',
    registered_agent: 'Registered agent',
    registered_developer: 'Registered developer',
    admin: 'Administrator',
    bot: 'Bot account',
  };
  return labels[r] ?? (r ? r.replace(/_/g, ' ') : 'Member');
}
