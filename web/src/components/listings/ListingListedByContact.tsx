/** Contact name block for bot-ingested listings (replaces author profile). */
export function ListingListedByContact({ contactName }: { contactName: string }) {
  const name = contactName.trim();
  if (!name) return null;

  return (
    <div className="border-t border-gray-200 pt-5">
      <h4 className="text-sm font-semibold text-gray-900">Listed by</h4>
      <p className="mt-2 text-base font-medium text-gray-900">{name}</p>
    </div>
  );
}
