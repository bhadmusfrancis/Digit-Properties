/** Default author bios for Trends articles (keyed by author display name). */
export const TREND_AUTHOR_BIOS: Record<string, string> = {
  'Digit Properties Editorial':
    'The Digit Properties editorial team covers Nigerian real estate markets, policy, and property documentation. Based in Lagos, Ibadan, and Warri.',
  'FABHA International':
    'FABHA International operates Digit Properties, providing real estate advertisement, land titling support, property valuation, and document verification across Nigeria.',
};

export function getTrendAuthorBio(author?: string | null): string | undefined {
  if (!author?.trim()) return undefined;
  return TREND_AUTHOR_BIOS[author.trim()] ?? `${author.trim()} writes on Nigerian property markets, housing, and real estate trends for Digit Properties.`;
}
