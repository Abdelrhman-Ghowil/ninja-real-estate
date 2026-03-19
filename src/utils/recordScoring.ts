import type { PropertyRecord } from '../api/records';

const SCORING_SETTINGS_KEY = 'ninja-scoring-settings-v1';

export interface ScoringSettings {
  fallbackMarketAveragePrice: number;
  fallbackDistanceKm: number | null;
  fallbackStoreHeightM: number | null;
  unknownCriterionScore: 1 | 2 | 3 | 4 | 5;
  districtMarketAverages: Record<string, number>;
}

export interface ScoreCriterion {
  key: 'distance' | 'size' | 'height' | 'price' | 'contract' | 'status';
  label: string;
  score: number;
  max: number;
  value: string;
}

export interface RecordScoreResult {
  totalScore: number;
  maxScore: number;
  percentage: number;
  criteria: ScoreCriterion[];
}

export const DEFAULT_SCORING_SETTINGS: ScoringSettings = {
  fallbackMarketAveragePrice: 500_000,
  fallbackDistanceKm: null,
  fallbackStoreHeightM: null,
  unknownCriterionScore: 3,
  districtMarketAverages: {},
};

function toNum(value: string | null | undefined): number | null {
  if (!value) return null;
  const parsed = Number.parseFloat(value.replace(/[^\d.-]/g, ''));
  return Number.isFinite(parsed) ? parsed : null;
}

function parseFromText(text: string | null | undefined, pattern: RegExp): number | null {
  if (!text) return null;
  const match = text.match(pattern);
  if (!match || !match[1]) return null;
  const value = Number.parseFloat(match[1]);
  return Number.isFinite(value) ? value : null;
}

function parseDistanceKm(record: PropertyRecord, settings: ScoringSettings): number | null {
  const fromText = parseFromText(
    record.raw_text,
    /(\d+(?:\.\d+)?)\s*(?:km|كيلومتر|كيلو|كم)/i
  );
  return fromText ?? settings.fallbackDistanceKm;
}

function parseHeightM(record: PropertyRecord, settings: ScoringSettings): number | null {
  const fromText = parseFromText(
    record.raw_text,
    /(?:height|ارتفاع)\D{0,10}(\d+(?:\.\d+)?)\s*(?:m|meter|متر)/i
  );
  const generic = parseFromText(record.raw_text, /(\d+(?:\.\d+)?)\s*(?:m|meter|متر)/i);
  return fromText ?? generic ?? settings.fallbackStoreHeightM;
}

function scoreDistance(distanceKm: number | null, fallbackScore: number): ScoreCriterion {
  if (distanceKm == null) {
    return { key: 'distance', label: 'Distance from Target', score: fallbackScore, max: 5, value: 'Unknown' };
  }
  if (distanceKm <= 1) return { key: 'distance', label: 'Distance from Target', score: 5, max: 5, value: `${distanceKm} km` };
  if (distanceKm <= 2) return { key: 'distance', label: 'Distance from Target', score: 4, max: 5, value: `${distanceKm} km` };
  if (distanceKm <= 3) return { key: 'distance', label: 'Distance from Target', score: 3, max: 5, value: `${distanceKm} km` };
  if (distanceKm <= 4) return { key: 'distance', label: 'Distance from Target', score: 2, max: 5, value: `${distanceKm} km` };
  return { key: 'distance', label: 'Distance from Target', score: 1, max: 5, value: `${distanceKm} km` };
}

function scoreSize(areaM2: number | null, fallbackScore: number): ScoreCriterion {
  if (areaM2 == null) return { key: 'size', label: 'Size', score: fallbackScore, max: 5, value: 'Unknown' };
  if (areaM2 >= 200 && areaM2 <= 250) return { key: 'size', label: 'Size', score: 5, max: 5, value: `${areaM2} sqm` };
  if (areaM2 >= 150 && areaM2 <= 300) return { key: 'size', label: 'Size', score: 4, max: 5, value: `${areaM2} sqm` };
  if ((areaM2 >= 149.5 && areaM2 < 150) || (areaM2 > 300 && areaM2 <= 301)) {
    return { key: 'size', label: 'Size', score: 3, max: 5, value: `${areaM2} sqm` };
  }
  if (areaM2 >= 51 && areaM2 < 149.5) return { key: 'size', label: 'Size', score: 2, max: 5, value: `${areaM2} sqm` };
  return { key: 'size', label: 'Size', score: 1, max: 5, value: `${areaM2} sqm` };
}

function scoreHeight(heightM: number | null, fallbackScore: number): ScoreCriterion {
  if (heightM == null) return { key: 'height', label: 'Store Height', score: fallbackScore, max: 5, value: 'Unknown' };
  if (heightM >= 4) return { key: 'height', label: 'Store Height', score: 5, max: 5, value: `${heightM} m` };
  if (heightM >= 3.5) return { key: 'height', label: 'Store Height', score: 4, max: 5, value: `${heightM} m` };
  if (heightM >= 3) return { key: 'height', label: 'Store Height', score: 3, max: 5, value: `${heightM} m` };
  if (heightM >= 2.5) return { key: 'height', label: 'Store Height', score: 2, max: 5, value: `${heightM} m` };
  return { key: 'height', label: 'Store Height', score: 1, max: 5, value: `${heightM} m` };
}

function buildDistrictKey(city: string, region: string): string {
  return `${city.trim().toLowerCase()}::${region.trim().toLowerCase()}`;
}

function resolveDistrictAverage(record: PropertyRecord, settings: ScoringSettings): number {
  const districtKey = buildDistrictKey(record.city || '', record.region || '');
  return settings.districtMarketAverages[districtKey] || settings.fallbackMarketAveragePrice;
}

function scorePriceVsAverage(price: number | null, marketAverage: number, fallbackScore: number): ScoreCriterion {
  if (price == null || marketAverage <= 0) {
    return { key: 'price', label: 'Price vs District Average', score: fallbackScore, max: 5, value: 'Unknown' };
  }
  const belowPct = ((marketAverage - price) / marketAverage) * 100;
  const ratioText = `${belowPct.toFixed(1)}% vs avg`;
  if (belowPct >= 15) return { key: 'price', label: 'Price vs District Average', score: 5, max: 5, value: ratioText };
  if (belowPct >= 10) return { key: 'price', label: 'Price vs District Average', score: 4, max: 5, value: ratioText };
  if (belowPct >= 5) return { key: 'price', label: 'Price vs District Average', score: 3, max: 5, value: ratioText };
  if (belowPct >= 0) return { key: 'price', label: 'Price vs District Average', score: 2, max: 5, value: ratioText };
  return { key: 'price', label: 'Price vs District Average', score: 1, max: 5, value: ratioText };
}

function scoreContractYears(contractYears: number | null, fallbackScore: number): ScoreCriterion {
  if (contractYears == null) return { key: 'contract', label: 'Contract Duration', score: fallbackScore, max: 5, value: 'Unknown' };
  if (contractYears >= 10) return { key: 'contract', label: 'Contract Duration', score: 5, max: 5, value: `${contractYears} years` };
  if (contractYears >= 8) return { key: 'contract', label: 'Contract Duration', score: 4, max: 5, value: `${contractYears} years` };
  if (contractYears >= 6) return { key: 'contract', label: 'Contract Duration', score: 3, max: 5, value: `${contractYears} years` };
  if (contractYears >= 4) return { key: 'contract', label: 'Contract Duration', score: 2, max: 5, value: `${contractYears} years` };
  return { key: 'contract', label: 'Contract Duration', score: 1, max: 5, value: `${contractYears} years` };
}

function scoreStoreStatus(record: PropertyRecord, fallbackScore: number): ScoreCriterion {
  const text = `${record.building_status || ''} ${record.raw_text || ''}`.toLowerCase();
  const maxMonths = toNum(record.expected_completion_max_months);
  const ready = /ready|جاهز|جاهزة|فوري|immediate/.test(text);
  const occupied = /occupied|مشغول|مؤجر|مستأجر/.test(text);
  const underConstruction = /construction|تحت|قيد|تشطيب|إنشاء|انشاء/.test(text);

  if (ready) return { key: 'status', label: 'Store Status', score: 5, max: 5, value: 'Ready for rent' };
  if (underConstruction && maxMonths != null && maxMonths < 3) {
    return { key: 'status', label: 'Store Status', score: 4, max: 5, value: 'Under construction (<3 months)' };
  }
  if (underConstruction) {
    return { key: 'status', label: 'Store Status', score: 3, max: 5, value: 'Under construction' };
  }
  if (occupied) {
    return { key: 'status', label: 'Store Status', score: 1, max: 5, value: 'Occupied' };
  }

  return { key: 'status', label: 'Store Status', score: fallbackScore, max: 5, value: 'Unknown' };
}

export function normalizeDistrictKey(city: string, region: string): string {
  return buildDistrictKey(city, region);
}

export function loadScoringSettings(): ScoringSettings {
  if (typeof window === 'undefined') return DEFAULT_SCORING_SETTINGS;
  const raw = window.localStorage.getItem(SCORING_SETTINGS_KEY);
  if (!raw) return DEFAULT_SCORING_SETTINGS;
  try {
    const parsed = JSON.parse(raw) as Partial<ScoringSettings>;
    return {
      fallbackMarketAveragePrice: Number(parsed.fallbackMarketAveragePrice) || DEFAULT_SCORING_SETTINGS.fallbackMarketAveragePrice,
      fallbackDistanceKm: parsed.fallbackDistanceKm == null ? null : Number(parsed.fallbackDistanceKm),
      fallbackStoreHeightM: parsed.fallbackStoreHeightM == null ? null : Number(parsed.fallbackStoreHeightM),
      unknownCriterionScore: (parsed.unknownCriterionScore as 1 | 2 | 3 | 4 | 5) || DEFAULT_SCORING_SETTINGS.unknownCriterionScore,
      districtMarketAverages: parsed.districtMarketAverages || {},
    };
  } catch {
    return DEFAULT_SCORING_SETTINGS;
  }
}

export function saveScoringSettings(settings: ScoringSettings): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(SCORING_SETTINGS_KEY, JSON.stringify(settings));
}

export function scoreRecord(record: PropertyRecord, settings: ScoringSettings): RecordScoreResult {
  const fallbackScore = settings.unknownCriterionScore;
  const distance = parseDistanceKm(record, settings);
  const area = toNum(record.area_m2);
  const height = parseHeightM(record, settings);
  const price = toNum(record.price);
  const contractYears = toNum(record.contract_duration_years);
  const marketAverage = resolveDistrictAverage(record, settings);

  const criteria: ScoreCriterion[] = [
    scoreDistance(distance, fallbackScore),
    scoreSize(area, fallbackScore),
    scoreHeight(height, fallbackScore),
    scorePriceVsAverage(price, marketAverage, fallbackScore),
    scoreContractYears(contractYears, fallbackScore),
    scoreStoreStatus(record, fallbackScore),
  ];

  const totalScore = criteria.reduce((sum, item) => sum + item.score, 0);
  const maxScore = criteria.reduce((sum, item) => sum + item.max, 0);
  const percentage = maxScore > 0 ? Math.round((totalScore / maxScore) * 100) : 0;

  return { totalScore, maxScore, percentage, criteria };
}
