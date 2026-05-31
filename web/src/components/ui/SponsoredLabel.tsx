type SponsoredLabelProps = {
  /** Light text on a faint scrim — for thumbnails and media overlays. */
  overlay?: boolean;
  className?: string;
};

export function SponsoredLabel({ overlay = false, className = '' }: SponsoredLabelProps) {
  const base = overlay
    ? 'rounded bg-black/30 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-white/75'
    : 'text-[10px] font-medium uppercase tracking-wide text-gray-400';

  return (
    <span className={[base, className].filter(Boolean).join(' ')} aria-label="Sponsored">
      Sponsored
    </span>
  );
}
