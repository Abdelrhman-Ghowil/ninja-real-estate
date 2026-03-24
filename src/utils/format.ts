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

function buildGoogleEmbedFromQuery(query: string, apiKey?: string | null): string {
  const normalizedKey = apiKey?.trim();
  if (normalizedKey) {
    return `https://www.google.com/maps/embed/v1/place?key=${encodeURIComponent(normalizedKey)}&q=${encodeURIComponent(query)}`;
  }
  return `https://www.google.com/maps?q=${encodeURIComponent(query)}&output=embed`;
}

function parseMapQuery(urlValue: string): { embedUrl?: string; query?: string } | null {
  const value = urlValue.trim();
  if (!value) return null;

  const coords = value.match(/(-?\d{1,3}(?:\.\d+)?)\s*,\s*(-?\d{1,3}(?:\.\d+)?)/);
  if (coords) {
    return { query: `${coords[1]},${coords[2]}` };
  }

  if (!/^https?:\/\//i.test(value)) {
    return { query: value };
  }

  let parsed: URL | null = null;
  try {
    parsed = new URL(value);
  } catch {
    return { query: value };
  }

  const host = parsed.hostname.toLowerCase();
  if (!host.includes('google.') && !host.includes('maps.app.goo.gl') && !host.includes('goo.gl') && !host.includes('g.page')) {
    return { query: value };
  }

  if (parsed.pathname.includes('/maps/embed')) return { embedUrl: parsed.toString() };

  const q = parsed.searchParams.get('q')
    || parsed.searchParams.get('query')
    || parsed.searchParams.get('destination')
    || parsed.searchParams.get('daddr')
    || parsed.searchParams.get('ll');
  if (q) return { query: q };

  const atCoords = parsed.pathname.match(/@(-?\d{1,3}(?:\.\d+)?),(-?\d{1,3}(?:\.\d+)?)/);
  if (atCoords) {
    return { query: `${atCoords[1]},${atCoords[2]}` };
  }

  const deepLinkCoords = parsed.pathname.match(/!3d(-?\d{1,3}(?:\.\d+)?)!4d(-?\d{1,3}(?:\.\d+)?)/);
  if (deepLinkCoords) {
    return { query: `${deepLinkCoords[1]},${deepLinkCoords[2]}` };
  }

  const placePath = parsed.pathname.match(/\/place\/([^/]+)/);
  if (placePath) {
    const placeName = decodeURIComponent(placePath[1]).replace(/\+/g, ' ');
    return { query: placeName };
  }

  if (host.includes('maps.app.goo.gl') || host.includes('goo.gl')) return null;

  return { query: `${parsed.pathname}${parsed.search}` };
}

export function resolveRecordMapPreview(options: {
  recordUrl?: string | null;
  fallbackQuery?: string | null;
  apiKey?: string | null;
}): { embedUrl: string | null; openUrl: string | null; query: string | null } {
  const parsed = options.recordUrl ? parseMapQuery(options.recordUrl) : null;
  const query = parsed?.query || options.fallbackQuery?.trim() || null;
  const normalizedRecordUrl = options.recordUrl?.trim();

  const embedUrl = parsed?.embedUrl || (query ? buildGoogleEmbedFromQuery(query, options.apiKey) : null);
  const openUrl = normalizedRecordUrl || (query ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}` : null);

  return {
    embedUrl,
    openUrl,
    query,
  };
}
