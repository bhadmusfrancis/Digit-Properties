'use client';

/** Sortable <th> with ▲▼ indicators (listing tables). */
export function SortColumnHeader({
  label,
  active,
  ascending,
  onClick,
  className = '',
}: {
  label: string;
  active: boolean;
  ascending: boolean;
  onClick: () => void;
  className?: string;
}) {
  return (
    <th scope="col" className={className}>
      <button
        type="button"
        onClick={onClick}
        className="group inline-flex items-center gap-1 rounded px-0 py-0 text-left text-xs font-medium uppercase text-gray-500 hover:text-gray-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
        aria-sort={active ? (ascending ? 'ascending' : 'descending') : 'none'}
      >
        {label}
        <span className="inline-flex flex-col text-[10px] leading-[0.65] text-gray-400 group-hover:text-gray-600" aria-hidden>
          <span className={active && ascending ? 'text-primary-600' : ''}>▲</span>
          <span className={active && !ascending ? 'text-primary-600' : ''}>▼</span>
        </span>
      </button>
    </th>
  );
}
