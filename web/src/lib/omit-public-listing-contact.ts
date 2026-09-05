/** Remove phone/email from public listing payloads. Contact is served only via the gated contact API. */
export function omitPublicListingContact<T extends Record<string, unknown>>(listing: T): T {
  const next = { ...listing };
  delete (next as { agentPhone?: unknown }).agentPhone;
  delete (next as { agentEmail?: unknown }).agentEmail;
  return next;
}
