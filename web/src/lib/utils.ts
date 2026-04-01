export function formatPrice(amount: number, rentPeriod?: 'day' | 'month' | 'year' | string): string {
  const formatted = new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency: 'NGN',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
  if (rentPeriod && ['day', 'month', 'year'].includes(rentPeriod)) {
    const suffix = rentPeriod === 'day' ? '/day' : rentPeriod === 'month' ? '/month' : '/year';
    return `${formatted}${suffix}`;
  }
  return formatted;
}

export function formatDate(date: Date | string): string {
  return new Intl.DateTimeFormat('en-NG', {
    dateStyle: 'medium',
  }).format(new Date(date));
}

export function getWhatsAppUrl(phone: string, message: string): string {
  const clean = phone.replace(/\D/g, '');
  const num = clean.startsWith('234') ? clean : `234${clean.replace(/^0/, '')}`;
  return `https://wa.me/${num}?text=${encodeURIComponent(message)}`;
}

/** E.164-style href for tel: links (Nigeria-focused normalization). */
export function getTelHref(phone: string): string {
  const d = phone.replace(/\D/g, '');
  if (!d) return '#';
  let n = d;
  if (n.startsWith('0') && n.length >= 10) n = '234' + n.slice(1);
  else if (!n.startsWith('234') && n.length === 10) n = '234' + n;
  return `tel:+${n}`;
}
