import {
  ensureWhatsAppStyleDescription,
  formatWhatsAppMarkupToHtml,
  isWhatsAppImportListing,
} from '@/lib/whatsapp-description';

type Props = {
  description: string;
  tags?: string[] | null;
  className?: string;
};

export function ListingDescriptionContent({ description, tags, className = 'mt-4' }: Props) {
  if (!description) return null;

  const isWaImport = isWhatsAppImportListing(tags);
  const looksLikeHtml = /<[a-z][\s\S]*>/i.test(description);

  if (isWaImport) {
    const waText = ensureWhatsAppStyleDescription(description);
    return (
      <div
        className={`${className} text-gray-700 leading-relaxed break-words [&_strong]:font-semibold [&_em]:italic [&_del]:line-through`}
        dangerouslySetInnerHTML={{ __html: formatWhatsAppMarkupToHtml(waText) }}
      />
    );
  }

  if (looksLikeHtml) {
    return (
      <div
        className={`rich-html-content ${className} text-gray-700 prose prose-slate max-w-none prose-p:my-2 prose-ul:my-2 prose-li:my-0 prose-img:max-w-full prose-table:my-4 prose-table:border-collapse prose-th:border prose-td:border prose-a:text-primary-600`}
        dangerouslySetInnerHTML={{ __html: description }}
      />
    );
  }

  return (
    <div className={`${className} text-gray-700 prose prose-slate max-w-none prose-p:my-2`}>
      <p className="whitespace-pre-wrap break-words">{description}</p>
    </div>
  );
}
