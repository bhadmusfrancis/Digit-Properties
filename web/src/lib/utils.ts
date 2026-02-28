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
