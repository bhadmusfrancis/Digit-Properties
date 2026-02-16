export function formatPrice(amount: number): string {
  return new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency: 'NGN',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
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
