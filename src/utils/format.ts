import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import 'dayjs/locale/ar';

dayjs.extend(relativeTime);

export function formatPrice(price: string, currency: string = 'SAR'): string {
  const num = parseFloat(price);
  if (isNaN(num)) return price;
  return new Intl.NumberFormat('ar-SA', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(num);
}

export function formatArea(area: string): string {
  const num = parseFloat(area);
  if (isNaN(num)) return area;
  return `${num.toLocaleString()} م²`;
}

export function formatDate(dateStr: string): string {
  return dayjs(dateStr).format('DD/MM/YYYY');
}

export function fromNow(dateStr: string): string {
  return dayjs(dateStr).locale('ar').fromNow();
}
