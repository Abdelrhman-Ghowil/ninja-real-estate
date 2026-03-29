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

export function parseLatLng(value?: string | null): { lat: number; lng: number } | null {
  if (!value) return null;
  const match = value.trim().match(/^(-?\d{1,3}(?:\.\d+)?)\s*,\s*(-?\d{1,3}(?:\.\d+)?)$/);
  if (!match) return null;
  const lat = Number(match[1]);
  const lng = Number(match[2]);
  if (Number.isNaN(lat) || Number.isNaN(lng)) return null;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
  return { lat, lng };
}

function buildGoogleEmbedFromQuery(query: string, apiKey?: string | null): string {
  if (apiKey) {
    return `https://www.google.com/maps/embed/v1/place?key=${encodeURIComponent(apiKey)}&q=${encodeURIComponent(query)}&language=ar`;
  }
  return `https://maps.google.com/maps?q=${encodeURIComponent(query)}&t=&z=15&ie=UTF8&iwloc=&output=embed`;
}

function extractCoords(value: string): string | null {
  const coords = value.match(/(-?\d{1,3}(?:\.\d+)?)\s*,\s*(-?\d{1,3}(?:\.\d+)?)/);
  if (!coords) return null;
  return `${coords[1]},${coords[2]}`;
}

function extractDeepLinkCoords(value: string): string | null {
  const deepLinkCoords = value.match(/!3d(-?\d{1,3}(?:\.\d+)?)!4d(-?\d{1,3}(?:\.\d+)?)/);
  if (!deepLinkCoords) return null;
  return `${deepLinkCoords[1]},${deepLinkCoords[2]}`;
}

function parseMapQuery(urlValue: string): { embedUrl?: string; query?: string } | null {
  const value = urlValue.trim();
  if (!value) return null;

  const coords = extractCoords(value);
  if (coords) return { query: coords };

  const deepLinkCoords = extractDeepLinkCoords(value);
  if (deepLinkCoords) return { query: deepLinkCoords };

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

  const pathDeepLinkCoords = extractDeepLinkCoords(parsed.pathname);
  if (pathDeepLinkCoords) return { query: pathDeepLinkCoords };

  const pbDeepLinkCoords = extractDeepLinkCoords(parsed.searchParams.get('pb') ?? '');
  if (pbDeepLinkCoords) return { query: pbDeepLinkCoords };

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
  const openUrl = query
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`
    : normalizedRecordUrl || null;

  return {
    embedUrl,
    openUrl,
    query,
  };
}
