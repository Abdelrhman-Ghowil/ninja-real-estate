import { useState, useRef, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import Layout from '../components/Layout';
import SwipeCard from '../components/SwipeCard';
import StatusBadge from '../components/StatusBadge';
import Skeleton from '../components/Skeleton';
import { useRecords, useUpdateRecord } from '../hooks/useRecords';
import type { PropertyRecord } from '../api/records';
import { loadScoringSettings, scoreRecord } from '../utils/recordScoring';

type FilterStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'ALL';

const FILTER_CHIPS: { label: string; value: FilterStatus }[] = [
  { label: 'قيد الانتظار', value: 'PENDING' },
  { label: 'موافق عليه', value: 'APPROVED' },
  { label: 'مرفوض', value: 'REJECTED' },
  { label: 'الكل', value: 'ALL' },
];

function normalizeStatus(status: unknown): 'APPROVED' | 'REJECTED' | null {
  if (status === 'APPROVED' || status === 'REJECTED') return status;
  return null;
}

function getGoogleMapEmbedUrlFromQuery(query: string, apiKey: string | null): string {
  if (apiKey) {
    return `https://www.google.com/maps/embed/v1/place?key=${encodeURIComponent(apiKey)}&q=${encodeURIComponent(query)}`;
  }
  return `https://www.google.com/maps?q=${encodeURIComponent(query)}&output=embed`;
}

function getMapPreviewSource(url: string | null | undefined): { embedUrl?: string; query?: string } | null {
  if (!url) return null;
  const value = url.trim();
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
    || parsed.searchParams.get('daddr');
  if (q) {
    return { query: q };
  }

  const atCoords = parsed.pathname.match(/@(-?\d{1,3}(?:\.\d+)?),(-?\d{1,3}(?:\.\d+)?)/);
  if (atCoords) {
    return { query: `${atCoords[1]},${atCoords[2]}` };
  }

  const placePath = parsed.pathname.match(/\/place\/([^/]+)/);
  if (placePath) {
    const placeName = decodeURIComponent(placePath[1]).replace(/\+/g, ' ');
    return { query: placeName };
  }

  if (host.includes('maps.app.goo.gl') || host.includes('goo.gl')) {
    return null;
  }

  return { query: `${parsed.pathname}${parsed.search}` };
}

export default function ReviewPage() {
  const { data: records, isLoading, isError } = useRecords();
  const updateRecord = useUpdateRecord();
  const [filter, setFilter] = useState<FilterStatus>('PENDING');
  const [nameFilter, setNameFilter] = useState('');
  const [areaFilter, setAreaFilter] = useState('');
  const [weekRange, setWeekRange] = useState<{ start: Date; end: Date } | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<PropertyRecord | null>(null);
  const [comparisonMode, setComparisonMode] = useState(false);
  const [comparisonIds, setComparisonIds] = useState<number[]>([]);
  const [visibleMapRecordId, setVisibleMapRecordId] = useState<number | null>(null);
  const [skippedRecordIds, setSkippedRecordIds] = useState<number[]>([]);

  const normalizedNameFilter = nameFilter.trim().toLowerCase();
  const normalizedAreaFilter = areaFilter.trim().toLowerCase();
  const allRecords = records ?? [];
  const areaOptions = useMemo(() => {
    const options = new Set<string>();

    allRecords.forEach((record) => {
      [record.location, record.city, record.region].forEach((value) => {
        const normalizedValue = value?.trim();
        if (normalizedValue) {
          options.add(normalizedValue);
        }
      });
    });

    return Array.from(options).sort((a, b) => a.localeCompare(b, 'ar'));
  }, [allRecords]);
  const hasAdvancedFilters = Boolean(nameFilter.trim() || areaFilter.trim() || weekRange);

  const matchesAdvancedFilters = (record: PropertyRecord) => {
    const matchesName = !normalizedNameFilter || [
      record.location,
      record.city,
      record.region,
      record.raw_text,
    ].some((field) => field?.toLowerCase().includes(normalizedNameFilter));
    const matchesArea = !normalizedAreaFilter || [
      record.location,
      record.city,
      record.region,
    ].some((field) => field?.trim().toLowerCase().includes(normalizedAreaFilter));

    if (!weekRange) return matchesName && matchesArea;
    const createdAt = new Date(record.createdAt);
    if (Number.isNaN(createdAt.getTime())) return false;
    return matchesName && matchesArea && createdAt >= weekRange.start && createdAt < weekRange.end;
  };

  const filteredRecords = allRecords.filter((r) => {
    const status = normalizeStatus(r.Status);
    if (filter === 'PENDING') return status === null;
    if (filter === 'APPROVED') return status === 'APPROVED' && matchesAdvancedFilters(r);
    if (filter === 'REJECTED') return status === 'REJECTED' && matchesAdvancedFilters(r);
    return matchesAdvancedFilters(r);
  });

  const swipeableRecords = useMemo(() => {
    const pendingRecords = allRecords.filter((r) => normalizeStatus(r.Status) === null && matchesAdvancedFilters(r));
    if (pendingRecords.length <= 1) return pendingRecords;

    const pendingById = new Map(pendingRecords.map((record) => [record.id, record]));
    const normalizedSkippedIds = skippedRecordIds.filter((id) => pendingById.has(id));
    const skippedIdSet = new Set(normalizedSkippedIds);

    return [
      ...pendingRecords.filter((record) => !skippedIdSet.has(record.id)),
      ...normalizedSkippedIds.map((id) => pendingById.get(id)).filter((record): record is PropertyRecord => Boolean(record)),
    ];
  }, [allRecords, matchesAdvancedFilters, skippedRecordIds]);
  const comparisonCandidates = filter === 'PENDING' ? swipeableRecords : filteredRecords;
  const validComparisonIds = comparisonIds.filter((id) => allRecords.some((record) => record.id === id));
  const comparisonRecords = validComparisonIds
    .map((id) => allRecords.find((record) => record.id === id))
    .filter((record): record is PropertyRecord => Boolean(record));
  const currentCard = swipeableRecords[0];
  const googleMapsApiKey = ((import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string | undefined) ?? '').trim() || null;
  const currentMapQuery = [currentCard?.location, currentCard?.city, currentCard?.region]
    .filter(Boolean)
    .join(' ');
  const mapPreviewSource = getMapPreviewSource(currentCard?.Url_location);
  const resolvedMapQuery = mapPreviewSource?.query || currentMapQuery || null;
  const currentMapEmbedUrl = mapPreviewSource?.embedUrl
    || (resolvedMapQuery ? getGoogleMapEmbedUrlFromQuery(resolvedMapQuery, googleMapsApiKey) : null);
  const currentMapOpenUrl = currentCard?.Url_location?.trim()
    || (resolvedMapQuery ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(resolvedMapQuery)}` : null);
  const hasMapPreview = Boolean(currentMapEmbedUrl || currentMapOpenUrl || currentCard?.location);
  const isCurrentMapVisible = currentCard?.id != null && visibleMapRecordId === currentCard.id;

  function handleAction(record: PropertyRecord, status: 'APPROVED' | 'REJECTED') {
    setSkippedRecordIds((prev) => prev.filter((id) => id !== record.id));
    updateRecord.mutate({ id: record.id, data: { Status: status } });
    toast.success(status === 'APPROVED' ? 'تمت الموافقة' : 'تم الرفض', { duration: 2000 });
  }

  function handleNextRecord() {
    if (!currentCard || swipeableRecords.length <= 1) return;
    setVisibleMapRecordId(null);
    setSkippedRecordIds((prev) => {
      const nextIds = prev.filter((id) => id !== currentCard.id);
      return [...nextIds, currentCard.id];
    });
  }

  const pendingCount = (records ?? []).filter((r) => normalizeStatus(r.Status) === null).length;
  const totalCount = records?.length ?? 0;

  function toggleComparisonRecord(recordId: number) {
    const exists = comparisonCandidates.some((record) => record.id === recordId);
    if (!exists) return;
    setComparisonIds((prev) => {
      if (prev.includes(recordId)) return prev.filter((id) => id !== recordId);
      const prevValidCount = prev.filter((id) => allRecords.some((record) => record.id === id)).length;
      if (prevValidCount >= 5) {
        toast.error('You can compare up to 5 records');
        return prev;
      }
      return [...prev, recordId];
    });
  }

  function activateComparisonMode() {
    setComparisonMode(true);
  }

  function exitComparisonMode() {
    setComparisonMode(false);
  }

  function clearComparisonSelection() {
    setComparisonIds([]);
  }

  function clearAdvancedFilters() {
    setNameFilter('');
    setAreaFilter('');
    setWeekRange(null);
  }

  return (
    <Layout>
      <div dir="rtl">
        <div style={{ marginBottom: 24 }}>
          <h1 style={{ margin: 0, fontSize: 26, fontWeight: 700 }}>مراجعة العقارات</h1>
          {!isLoading && (
            <p style={{ margin: '6px 0 0', fontSize: 14, color: 'var(--color-text-muted)' }}>
              قيد الانتظار: <strong style={{ color: 'var(--color-warning)' }}>{pendingCount}</strong> / المجموع: <strong>{totalCount}</strong>
            </p>
          )}
        </div>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 32 }}>
          {FILTER_CHIPS.map((chip) => (
            <button
              key={chip.value}
              onClick={() => setFilter(chip.value)}
              style={{
                padding: '7px 18px', borderRadius: 100, border: '1px solid',
                borderColor: filter === chip.value ? 'var(--color-accent)' : 'var(--color-border)',
                background: filter === chip.value ? 'rgba(108,99,255,0.15)' : 'transparent',
                color: filter === chip.value ? 'var(--color-accent)' : 'var(--color-text-muted)',
                fontSize: 13, fontWeight: 500, cursor: 'pointer', transition: 'all 0.15s ease',
              }}
            >
              {chip.label}
            </button>
          ))}
        </div>

        <div style={{ marginBottom: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={() => setShowFilters((value) => !value)}
              style={{
                padding: '7px 16px', borderRadius: 100, border: '1px solid var(--color-border)',
                background: showFilters ? 'rgba(108,99,255,0.16)' : 'transparent',
                color: showFilters ? 'var(--color-accent)' : 'var(--color-text-muted)',
                fontSize: 13, fontWeight: 600, cursor: 'pointer', transition: 'all 0.15s ease',
              }}
              aria-expanded={showFilters}
              aria-controls="review-advanced-filters"
            >
              {showFilters ? 'إخفاء الفلاتر' : 'إظهار الفلاتر'}
            </button>
            <button
              type="button"
              onClick={comparisonMode ? exitComparisonMode : activateComparisonMode}
              style={{
                padding: '7px 16px',
                borderRadius: 100,
                border: comparisonMode ? '1px solid var(--color-border)' : '1px solid var(--color-accent)',
                background: comparisonMode ? 'var(--color-surface-2)' : 'rgba(108,99,255,0.14)',
                color: comparisonMode ? 'var(--color-text-muted)' : 'var(--color-accent)',
                fontSize: 13,
                fontWeight: 700,
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              {comparisonMode ? 'اخفاء المقارنة' : 'قارن'}
            </button>
          </div>
          {showFilters && (
            <motion.div
              id="review-advanced-filters"
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.18 }}
              style={{
                marginTop: 16,
                display: 'flex',
                flexWrap: 'wrap',
                gap: 10,
                alignItems: 'center',
              }}
            >
              <input
                className="input-field"
                placeholder="🔍  فلترة بالاسم أو المدينة أو المنطقة..."
                value={nameFilter}
                onChange={(e) => setNameFilter(e.target.value)}
                style={{ minHeight: 42, flex: '1 1 320px' }}
              />
              <AreaFilterField
                options={areaOptions}
                value={areaFilter}
                onChange={setAreaFilter}
              />
              <WeekPicker value={weekRange} onChange={setWeekRange} />
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <button
                  type="button"
                  onClick={clearAdvancedFilters}
                  disabled={!hasAdvancedFilters}
                  aria-label="مسح الفلاتر"
                  title="مسح الفلاتر"
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 999,
                    border: '1px solid var(--color-border)',
                    background: 'var(--color-surface-2)',
                    color: 'var(--color-text-muted)',
                    fontSize: 16,
                    fontWeight: 700,
                    cursor: !hasAdvancedFilters ? 'not-allowed' : 'pointer',
                    opacity: !hasAdvancedFilters ? 0.5 : 1,
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  ×
                </button>
              </div>
            </motion.div>
          )}
        </div>

        {comparisonMode && (
          <div style={{ marginBottom: 20 }}>
            <div style={{
              width: '100%',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-lg)',
              background: 'var(--color-surface)',
              padding: 12,
              display: 'flex',
              flexDirection: 'column',
              gap: 10,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
                <div>
                  <p style={{ margin: 0, fontSize: 14, fontWeight: 700 }}>Comparison mode</p>
                  <p style={{ margin: '3px 0 0', fontSize: 12, color: 'var(--color-text-muted)' }}>
                    Select 2 to 5 records to compare
                  </p>
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                  <span style={{
                    borderRadius: 999,
                    border: '1px solid var(--color-border)',
                    background: 'var(--color-surface-2)',
                    padding: '6px 10px',
                    fontSize: 12,
                    fontWeight: 700,
                    color: validComparisonIds.length >= 2 ? 'var(--color-success)' : 'var(--color-warning)',
                  }}>
                    {validComparisonIds.length} / 5
                  </span>
                  <button
                    type="button"
                    onClick={clearComparisonSelection}
                    disabled={validComparisonIds.length === 0}
                    style={{
                      padding: '6px 12px',
                      borderRadius: 999,
                      border: '1px solid var(--color-border)',
                      background: 'transparent',
                      color: validComparisonIds.length === 0 ? 'var(--color-border)' : 'var(--color-text-muted)',
                      fontSize: 12,
                      fontWeight: 700,
                      cursor: validComparisonIds.length === 0 ? 'not-allowed' : 'pointer',
                    }}
                  >
                    Clear
                  </button>
                  <button
                    type="button"
                    onClick={exitComparisonMode}
                    style={{
                      padding: '6px 12px',
                      borderRadius: 999,
                      border: '1px solid var(--color-border)',
                      background: 'var(--color-surface-2)',
                      color: 'var(--color-text-muted)',
                      fontSize: 12,
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    Exit
                  </button>
                </div>
              </div>

              {comparisonCandidates.length === 0 ? (
                <div style={{
                  border: '1px dashed var(--color-border)',
                  borderRadius: 'var(--radius-md)',
                  color: 'var(--color-text-muted)',
                  textAlign: 'center',
                  padding: 18,
                  fontSize: 13,
                }}>
                  No records available for comparison
                </div>
              ) : (
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                  gap: 8,
                }}>
                  {comparisonCandidates.map((record) => {
                    const selected = validComparisonIds.includes(record.id);
                    const disabled = !selected && validComparisonIds.length >= 5;
                    const score = scoreRecord(record, loadScoringSettings());
                    return (
                      <button
                        key={record.id}
                        type="button"
                        onClick={() => toggleComparisonRecord(record.id)}
                        disabled={disabled}
                        style={{
                          borderRadius: 'var(--radius-md)',
                          border: `1px solid ${selected ? 'var(--color-accent)' : 'var(--color-border)'}`,
                          background: selected ? 'rgba(108,99,255,0.14)' : 'var(--color-surface-2)',
                          textAlign: 'right',
                          padding: '9px 10px',
                          cursor: disabled ? 'not-allowed' : 'pointer',
                          opacity: disabled ? 0.55 : 1,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: 8,
                        }}
                      >
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: 'var(--color-text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {record.location || 'No title'}
                          </p>
                          <p style={{ margin: '2px 0 0', fontSize: 11, color: 'var(--color-text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {record.city || '—'} • {record.price || '—'} {record.currency || ''}
                          </p>
                          <p style={{ margin: '4px 0 0', fontSize: 11, color: 'var(--color-accent)', fontWeight: 700 }}>
                            Score: {score.totalScore}/{score.maxScore} ({score.percentage}%)
                          </p>
                        </div>
                        <span style={{
                          width: 18,
                          height: 18,
                          borderRadius: 6,
                          border: `1px solid ${selected ? 'var(--color-accent)' : 'var(--color-border)'}`,
                          background: selected ? 'var(--color-accent)' : 'transparent',
                          color: selected ? '#fff' : 'transparent',
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: 11,
                          fontWeight: 700,
                        }}>
                          ✓
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {comparisonMode && (
          <div style={{ marginBottom: 28 }}>
            {validComparisonIds.length < 2 ? (
              <div style={{
                borderRadius: 'var(--radius-lg)',
                border: '1px dashed var(--color-border)',
                background: 'var(--color-surface-2)',
                color: 'var(--color-text-muted)',
                textAlign: 'center',
                padding: 26,
                fontSize: 13,
                fontWeight: 600,
              }}>
                Select at least 2 records to see side-by-side comparison
              </div>
            ) : (
              <div style={{
                borderRadius: 'var(--radius-lg)',
                border: '1px solid var(--color-border)',
                background: 'var(--color-surface)',
                overflow: 'hidden',
              }}>
                <CompareRecordsTable records={comparisonRecords} onOpenRecord={setSelectedRecord} />
              </div>
            )}
          </div>
        )}

        {!comparisonMode && filter === 'PENDING' && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 32 }}>
            {isLoading ? (
              <div style={{ width: '100%', maxWidth: 480 }}><Skeleton height={400} /></div>
            ) : isError ? (
              <ErrorState />
            ) : swipeableRecords.length === 0 ? (
              <EmptySwipeState />
            ) : (
              <div style={{ width: '100%', maxWidth: 1120, display: 'grid', gap: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'center', direction: 'rtl' }}>
                  <button
                    type="button"
                    onClick={() => {
                      if (!currentCard?.id) return;
                      setVisibleMapRecordId((value) => (value === currentCard.id ? null : currentCard.id));
                    }}
                    disabled={!hasMapPreview}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 8,
                      minHeight: 42,
                      padding: '10px 16px',
                      borderRadius: 999,
                      border: isCurrentMapVisible ? '1px solid rgba(108,99,255,0.38)' : '1px solid var(--color-border)',
                      background: isCurrentMapVisible ? 'rgba(108,99,255,0.12)' : 'var(--color-surface)',
                      color: hasMapPreview ? 'var(--color-text)' : 'var(--color-text-muted)',
                      fontSize: 13,
                      fontWeight: 700,
                      cursor: hasMapPreview ? 'pointer' : 'not-allowed',
                      transition: 'all 0.18s ease',
                      boxShadow: isCurrentMapVisible ? '0 14px 28px rgba(108,99,255,0.12)' : 'none',
                    }}
                  >
                    <span aria-hidden="true">{isCurrentMapVisible ? '🙈' : '🗺️'}</span>
                    {isCurrentMapVisible ? 'إخفاء الموقع' : 'عرض الموقع على الخريطة'}
                  </button>
                </div>
                <div style={{
                  width: '100%',
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: 20,
                  alignItems: 'flex-start',
                  justifyContent: 'center',
                  direction: 'ltr',
                }}>
                  <AnimatePresence initial={false}>
                    {isCurrentMapVisible && (
                      <motion.div
                        key={currentCard?.id}
                        initial={{ opacity: 0, x: -16, scale: 0.98 }}
                        animate={{ opacity: 1, x: 0, scale: 1 }}
                        exit={{ opacity: 0, x: -16, scale: 0.98 }}
                        transition={{ duration: 0.22 }}
                        style={{
                          flex: '1 1 360px',
                          minWidth: 320,
                          maxWidth: 560,
                          direction: 'rtl',
                        }}
                      >
                        <div style={{
                          background: 'linear-gradient(180deg, rgba(108,99,255,0.14), rgba(108,99,255,0.04))',
                          border: '1px solid rgba(108,99,255,0.3)',
                          borderRadius: 'var(--radius-xl)',
                          padding: 16,
                        }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <span style={{
                                width: 28, height: 28, borderRadius: 8, display: 'inline-flex',
                                alignItems: 'center', justifyContent: 'center',
                                background: 'rgba(108,99,255,0.16)', color: 'var(--color-accent)', fontSize: 14,
                              }}>🗺️</span>
                              <div>
                                <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: 'var(--color-text)' }}>موقع العقار</p>
                                <p style={{ margin: '2px 0 0', fontSize: 11, color: 'var(--color-text-muted)' }}>
                                  {currentCard?.location || 'لا يوجد موقع متاح'}
                                </p>
                              </div>
                            </div>
                            {currentMapOpenUrl && (
                              <a
                                href={currentMapOpenUrl}
                                target="_blank"
                                rel="noreferrer"
                                style={{
                                  padding: '6px 12px',
                                  borderRadius: 999,
                                  border: '1px solid var(--color-border)',
                                  background: 'var(--color-surface)',
                                  color: 'var(--color-accent)',
                                  fontSize: 11,
                                  fontWeight: 700,
                                  textDecoration: 'none',
                                  whiteSpace: 'nowrap',
                                }}
                              >
                                فتح Google Maps
                              </a>
                            )}
                          </div>
                          {currentMapEmbedUrl ? (
                            <iframe
                              key={currentCard?.id}
                              src={currentMapEmbedUrl}
                              title={`خريطة ${currentCard?.location || 'العقار'}`}
                              loading="lazy"
                              referrerPolicy="no-referrer-when-downgrade"
                              style={{
                                width: '100%',
                                height: 300,
                                border: 0,
                                borderRadius: 'var(--radius-lg)',
                                background: 'var(--color-surface-2)',
                              }}
                            />
                          ) : (
                            <div style={{
                              height: 300,
                              borderRadius: 'var(--radius-lg)',
                              border: '1px dashed var(--color-border)',
                              background: 'var(--color-surface-2)',
                              color: 'var(--color-text-muted)',
                              fontSize: 13,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              textAlign: 'center',
                              padding: 24,
                            }}>
                              لا يمكن عرض الخريطة لهذا الرابط
                            </div>
                          )}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                  <div style={{ flex: '1 1 480px', maxWidth: 500, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, direction: 'rtl' }}>
                    <div style={{ position: 'relative', width: '100%', maxWidth: 480, height: 480 }}>
                    {swipeableRecords.slice(0, 3).reverse().map((record, idx, arr) => {
                      const isTop = idx === arr.length - 1;
                      const stackOffset = (arr.length - 1 - idx) * 8;
                      const stackScale = 1 - (arr.length - 1 - idx) * 0.04;
                      return (
                        <motion.div
                          key={record.id}
                          style={{ position: 'absolute', width: '100%', zIndex: isTop ? 10 : idx }}
                          animate={{ y: stackOffset, scale: stackScale }}
                          transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                        >
                          <SwipeCard record={record} isTop={isTop}
                            onApprove={() => handleAction(record, 'APPROVED')}
                            onReject={() => handleAction(record, 'REJECTED')}
                          />
                        </motion.div>
                      );
                    })}
                  </div>
                    <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
                    <ActionButton label="رفض" icon="✕" color="var(--color-danger)"
                      onClick={() => currentCard && handleAction(currentCard, 'REJECTED')} />
                    <button onClick={handleNextRecord} disabled={swipeableRecords.length <= 1}
                      style={{
                        width: 44, height: 44, borderRadius: '50%',
                        border: '1px solid var(--color-border)', background: 'var(--color-surface)',
                        color: swipeableRecords.length > 1 ? 'var(--color-text-muted)' : 'var(--color-border)',
                        cursor: swipeableRecords.length > 1 ? 'pointer' : 'not-allowed',
                        fontSize: 18, display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontWeight: 700, transition: 'all 0.15s ease',
                      }} title="السجل التالي">
                      ↷
                    </button>
                    <ActionButton label="موافقة" icon="✓" color="var(--color-success)"
                      onClick={() => currentCard && handleAction(currentCard, 'APPROVED')} />
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {!comparisonMode && filter !== 'PENDING' && (
          <div>
            {isLoading ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {[1,2,3].map(i => <Skeleton key={i} height={80} />)}
              </div>
            ) : filteredRecords.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 60, color: 'var(--color-text-muted)' }}>
                لا توجد سجلات
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {filteredRecords.map((record) => (
                  <RecordRow key={record.id} record={record} onAction={handleAction} onOpen={() => setSelectedRecord(record)} />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
      <AnimatePresence>
        {selectedRecord && (
          <RecordDetailsModal
            record={selectedRecord}
            onClose={() => setSelectedRecord(null)}
            onAction={handleAction}
          />
        )}
      </AnimatePresence>
      <ChatWidget />
    </Layout>
  );
}

function ChatWidget() {
  return null;
}

function AreaFilterField({
  options,
  value,
  onChange,
}: {
  options: string[];
  value: string;
  onChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const normalizedValue = value.trim().toLowerCase();
  const filteredOptions = useMemo(() => {
    if (!normalizedValue) return options.slice(0, 80);
    return options
      .filter((option) => option.toLowerCase().includes(normalizedValue))
      .slice(0, 80);
  }, [normalizedValue, options]);

  useEffect(() => {
    function handleOutsideClick(event: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    window.addEventListener('mousedown', handleOutsideClick);
    return () => window.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  return (
    <div ref={rootRef} style={{ position: 'relative', flex: '1 1 260px', minWidth: 220 }}>
      <div
        style={{
          height: 42,
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          borderRadius: 12,
          border: `1px solid ${open ? 'var(--color-accent)' : 'var(--color-border)'}`,
          background: open ? 'rgba(108,99,255,0.08)' : 'var(--color-surface)',
          paddingInline: 12,
          transition: 'all 0.15s ease',
          boxShadow: open ? '0 0 0 3px rgba(108,99,255,0.08)' : 'none',
        }}
      >
        <span style={{ fontSize: 13, color: 'var(--color-accent)', flexShrink: 0 }}>⌕</span>
        <input
          className="input-field"
          placeholder="ابحث عن المنطقة..."
          value={value}
          onFocus={() => setOpen(true)}
          onChange={(e) => {
            onChange(e.target.value);
            setOpen(true);
          }}
          style={{
            minHeight: 0,
            height: '100%',
            border: 'none',
            background: 'transparent',
            padding: 0,
            boxShadow: 'none',
          }}
        />
        <button
          type="button"
          onClick={() => setOpen((prev) => !prev)}
          aria-label="عرض المناطق"
          style={{
            width: 24,
            height: 24,
            borderRadius: 8,
            border: 'none',
            background: 'rgba(108,99,255,0.14)',
            color: 'var(--color-accent)',
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            fontSize: 12,
            transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
            transition: 'transform 0.15s ease',
          }}
        >
          ▾
        </button>
      </div>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.98 }}
            transition={{ duration: 0.14 }}
            style={{
              position: 'absolute',
              top: 48,
              insetInlineStart: 0,
              width: '100%',
              zIndex: 30,
              borderRadius: 14,
              border: '1px solid var(--color-border)',
              background: 'var(--color-surface)',
              boxShadow: '0 18px 36px rgba(0,0,0,0.28)',
              overflow: 'hidden',
            }}
          >
            <div style={{
              padding: '10px 12px',
              borderBottom: '1px solid var(--color-border)',
              background: 'linear-gradient(180deg, rgba(108,99,255,0.08), rgba(108,99,255,0.02))',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 8,
            }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-text)' }}>المناطق</span>
              <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>{filteredOptions.length}</span>
            </div>
            <div style={{ maxHeight: 220, overflowY: 'auto', padding: 6 }}>
              {!filteredOptions.length ? (
                <div style={{
                  padding: '12px 10px',
                  borderRadius: 10,
                  color: 'var(--color-text-muted)',
                  fontSize: 12,
                  textAlign: 'center',
                  background: 'var(--color-surface-2)',
                }}>
                  لا توجد نتائج
                </div>
              ) : (
                filteredOptions.map((option) => {
                  const isActive = option === value;
                  return (
                    <button
                      key={option}
                      type="button"
                      onClick={() => {
                        onChange(option);
                        setOpen(false);
                      }}
                      style={{
                        width: '100%',
                        border: 'none',
                        background: isActive ? 'rgba(108,99,255,0.14)' : 'transparent',
                        color: isActive ? 'var(--color-accent)' : 'var(--color-text)',
                        borderRadius: 10,
                        padding: '10px 12px',
                        textAlign: 'right',
                        cursor: 'pointer',
                        fontSize: 13,
                        fontWeight: isActive ? 700 : 500,
                        transition: 'background 0.15s ease, color 0.15s ease',
                      }}
                    >
                      {option}
                    </button>
                  );
                })
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function ActionButton({ label, icon, color, onClick }: { label: string; icon: string; color: string; onClick: () => void }) {
  return (
    <motion.button onClick={onClick} whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
      style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4,
        width: 72, height: 72, borderRadius: '50%',
        border: `2px solid ${color}`,
        background: `${color}1a`,
        color, cursor: 'pointer', fontSize: 22, fontWeight: 700, transition: 'background 0.15s ease',
      }}
    >
      <span>{icon}</span>
      <span style={{ fontSize: 11 }}>{label}</span>
    </motion.button>
  );
}

function CompareRecordsTable({
  records,
  onOpenRecord,
}: {
  records: PropertyRecord[];
  onOpenRecord: (record: PropertyRecord) => void;
}) {
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', minWidth: 1080, borderCollapse: 'separate', borderSpacing: 0 }} dir="rtl">
        <thead>
          <tr>
            <th style={compareHeaderCellStyle}>العقار</th>
            <th style={compareHeaderCellStyle}>المدينة / المنطقة</th>
            <th style={compareHeaderCellStyle}>الحالة</th>
            <th style={compareHeaderCellStyle}>السعر</th>
            <th style={compareHeaderCellStyle}>المساحة</th>
            <th style={compareHeaderCellStyle}>العقد</th>
            <th style={compareHeaderCellStyle}>البناء</th>
            <th style={compareHeaderCellStyle}>الاكتمال</th>
            <th style={compareHeaderCellStyleLast}>النتيجة</th>
          </tr>
        </thead>
        <tbody>
          {records.map((record, index) => {
            const score = scoreRecord(record, loadScoringSettings());
            const scoreTone = getScoreTone(score.percentage);
            return (
              <motion.tr
                key={record.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                style={{
                  background: index % 2 === 0 ? 'rgba(255,255,255,0.01)' : 'rgba(255,255,255,0.03)',
                }}
              >
                <td style={compareBodyCellStyle}>
                  <div style={{ display: 'grid', gap: 8, minWidth: 180 }}>
                    <div>
                      <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: 'var(--color-text)' }}>
                        {record.location || 'بدون اسم'}
                      </p>
                      <p style={{ margin: '4px 0 0', fontSize: 11, color: 'var(--color-text-muted)' }}>
                        #{record.id}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => onOpenRecord(record)}
                      style={{
                        width: 'fit-content',
                        padding: '6px 10px',
                        borderRadius: 8,
                        border: '1px solid var(--color-border)',
                        background: 'var(--color-surface-2)',
                        color: 'var(--color-text-muted)',
                        fontSize: 11,
                        fontWeight: 700,
                        cursor: 'pointer',
                      }}
                    >
                      التفاصيل
                    </button>
                  </div>
                </td>
                <td style={compareBodyCellStyle}>
                  <div style={{ display: 'grid', gap: 4 }}>
                    <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text)' }}>{record.city || '—'}</span>
                    <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>{record.region || '—'}</span>
                  </div>
                </td>
                <td style={compareBodyCellStyle}>
                  <StatusBadge status={normalizeStatus(record.Status)} size="sm" />
                </td>
                <td style={compareBodyCellStyle}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-text)' }}>
                    {`${record.price || '—'} ${record.currency || ''}`.trim()}
                  </span>
                </td>
                <td style={compareBodyCellStyle}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text)' }}>
                    {record.area_m2 ? `${record.area_m2} م²` : '—'}
                  </span>
                </td>
                <td style={compareBodyCellStyle}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text)' }}>
                    {record.contract_duration_years ? `${record.contract_duration_years} سنة` : '—'}
                  </span>
                </td>
                <td style={compareBodyCellStyle}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text)' }}>
                    {record.building_status || '—'}
                  </span>
                </td>
                <td style={compareBodyCellStyle}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text)' }}>
                    {formatCompletion(record)}
                  </span>
                </td>
                <td style={compareScoreCellStyle}>
                  <div style={{ display: 'grid', justifyItems: 'center', gap: 6 }}>
                    <span style={{
                      padding: '7px 10px',
                      borderRadius: 999,
                      border: `1px solid ${scoreTone.border}`,
                      background: scoreTone.background,
                      color: scoreTone.text,
                      fontSize: 12,
                      fontWeight: 800,
                      minWidth: 88,
                      textAlign: 'center',
                    }}>
                      {score.percentage}%
                    </span>
                    <span style={{ fontSize: 11, color: 'var(--color-text-muted)', fontWeight: 700 }}>
                      {score.totalScore}/{score.maxScore}
                    </span>
                  </div>
                </td>
              </motion.tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function formatCompletion(record: PropertyRecord): string {
  if (!record.expected_completion_min_months && !record.expected_completion_max_months) return '—';
  return `${record.expected_completion_min_months || '—'} - ${record.expected_completion_max_months || '—'} شهر`;
}

function getScoreTone(percentage: number) {
  if (percentage >= 90) {
    return {
      background: 'rgba(139,92,246,0.14)',
      border: 'rgba(139,92,246,0.4)',
      text: '#c4b5fd',
    };
  }
  if (percentage >= 75) {
    return {
      background: 'rgba(34,197,94,0.12)',
      border: 'rgba(34,197,94,0.35)',
      text: '#86efac',
    };
  }
  if (percentage >= 60) {
    return {
      background: 'rgba(234,179,8,0.12)',
      border: 'rgba(234,179,8,0.35)',
      text: '#fde047',
    };
  }
  if (percentage >= 40) {
    return {
      background: 'rgba(249,115,22,0.12)',
      border: 'rgba(249,115,22,0.35)',
      text: '#fdba74',
    };
  }
  return {
    background: 'rgba(239,68,68,0.12)',
    border: 'rgba(239,68,68,0.35)',
    text: '#fca5a5',
  };
}

const compareHeaderCellStyle: React.CSSProperties = {
  padding: '12px 14px',
  textAlign: 'right',
  fontSize: 12,
  fontWeight: 800,
  color: 'var(--color-text-muted)',
  background: 'var(--color-surface-2)',
  borderBottom: '1px solid var(--color-border)',
  borderInlineEnd: '1px solid var(--color-border)',
  whiteSpace: 'nowrap',
};

const compareHeaderCellStyleLast: React.CSSProperties = {
  ...compareHeaderCellStyle,
  borderInlineEnd: 'none',
  textAlign: 'center',
};

const compareBodyCellStyle: React.CSSProperties = {
  padding: '14px',
  borderBottom: '1px solid var(--color-border)',
  borderInlineEnd: '1px solid var(--color-border)',
  verticalAlign: 'middle',
  textAlign: 'right',
};

const compareScoreCellStyle: React.CSSProperties = {
  ...compareBodyCellStyle,
  borderInlineEnd: 'none',
  textAlign: 'center',
  minWidth: 120,
};

function RecordRow({
  record,
  onAction,
  onOpen,
}: {
  record: PropertyRecord;
  onAction: (r: PropertyRecord, s: 'APPROVED' | 'REJECTED') => void;
  onOpen: () => void;
}) {
  const score = scoreRecord(record, loadScoringSettings());
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
      onClick={onOpen}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onOpen();
        }
      }}
      role="button"
      tabIndex={0}
      style={{
        background: 'var(--color-surface)', border: '1px solid var(--color-border)',
        borderRadius: 'var(--radius-lg)', padding: '16px 20px',
        display: 'flex', alignItems: 'center', gap: 16,
        cursor: 'pointer',
      }}
    >
      <div style={{ flex: 1 }}>
        <p style={{ margin: 0, fontWeight: 600, fontSize: 15 }}>{record.location}</p>
        <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--color-text-muted)' }}>
          {record.city} &bull; {record.price} {record.currency}
        </p>
      </div>
      <span style={{
        padding: '5px 9px',
        borderRadius: 999,
        border: '1px solid rgba(108,99,255,0.35)',
        background: 'rgba(108,99,255,0.12)',
        color: 'var(--color-accent)',
        fontSize: 11,
        fontWeight: 700,
      }}>
        {score.totalScore}/{score.maxScore}
      </span>
      <StatusBadge status={normalizeStatus(record.Status)} size="sm" />
      <div style={{ display: 'flex', gap: 8 }}>
        <SmallBtn label="موافقة" color="var(--color-success)" onClick={(event) => {
          event.stopPropagation();
          onAction(record, 'APPROVED');
        }} />
        <SmallBtn label="رفض" color="var(--color-danger)" onClick={(event) => {
          event.stopPropagation();
          onAction(record, 'REJECTED');
        }} />
      </div>
    </motion.div>
  );
}

function SmallBtn({
  label,
  color,
  onClick,
}: {
  label: string;
  color: string;
  onClick: (event: React.MouseEvent<HTMLButtonElement>) => void;
}) {
  return (
    <button onClick={onClick} style={{
      padding: '4px 12px', borderRadius: 6, border: `1px solid ${color}`,
      background: 'transparent', color, fontSize: 12, cursor: 'pointer', transition: 'all 0.15s ease',
    }}>{label}</button>
  );
}

function RecordDetailsModal({
  record,
  onClose,
  onAction,
}: {
  record: PropertyRecord;
  onClose: () => void;
  onAction: (r: PropertyRecord, s: 'APPROVED' | 'REJECTED') => void;
}) {
  const score = scoreRecord(record, loadScoringSettings());
  const fields: [string, string][] = [
    ['الموقع', record.location || '—'],
    ['رابط الموقع', record.Url_location || '—'],
    ['المدينة', record.city || '—'],
    ['المنطقة', record.region || '—'],
    ['السعر', `${record.price || '—'} ${record.currency || ''}`.trim()],
    ['المساحة', record.area_m2 ? `${record.area_m2} م²` : '—'],
    ['مدة العقد', record.contract_duration_years ? `${record.contract_duration_years} سنة` : '—'],
    ['حالة البناء', record.building_status || '—'],
    [
      'الاكتمال المتوقع',
      record.expected_completion_min_months || record.expected_completion_max_months
        ? `${record.expected_completion_min_months || '—'} - ${record.expected_completion_max_months || '—'} شهر`
        : '—',
    ],
    ['تاريخ الإضافة', new Date(record.createdAt).toLocaleString('ar-SA')],
    ['الدرجة النهائية', `${score.totalScore}/${score.maxScore} (${score.percentage}%)`],
  ];

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 130,
        background: 'rgba(0,0,0,0.7)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
      }}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 12 }}
        onClick={(event) => event.stopPropagation()}
        dir="rtl"
        style={{
          width: '100%',
          maxWidth: 680,
          maxHeight: '90vh',
          overflowY: 'auto',
          background: 'var(--color-surface)',
          border: '1px solid var(--color-border)',
          borderRadius: 'var(--radius-xl)',
          padding: 24,
          boxShadow: '0 24px 80px rgba(0,0,0,0.55)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
          <h3 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>تفاصيل العقار</h3>
          <button
            onClick={onClose}
            style={{
              width: 34,
              height: 34,
              borderRadius: 10,
              border: '1px solid var(--color-border)',
              background: 'var(--color-surface-2)',
              color: 'var(--color-text-muted)',
              fontSize: 18,
              cursor: 'pointer',
            }}
          >
            ✕
          </button>
        </div>

        <div style={{ marginBottom: 16 }}>
          <StatusBadge status={normalizeStatus(record.Status)} />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 10, marginBottom: 16 }}>
          {fields.map(([label, value]) => (
            <div key={label} style={{
              padding: '11px 12px',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--color-border)',
              background: 'var(--color-surface-2)',
            }}>
              <p style={{ margin: 0, fontSize: 11, color: 'var(--color-text-muted)' }}>{label}</p>
              <p style={{ margin: '4px 0 0', fontSize: 14, fontWeight: 600, wordBreak: 'break-word' }}>{value}</p>
            </div>
          ))}
        </div>

        {record.Url_location && (
          <a
            href={record.Url_location}
            target="_blank"
            rel="noreferrer"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              marginBottom: 16,
              padding: '8px 12px',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--color-border)',
              background: 'var(--color-surface-2)',
              color: 'var(--color-accent)',
              fontSize: 12,
              fontWeight: 600,
              textDecoration: 'none',
            }}
          >
            📍 فتح الموقع على الخريطة
          </a>
        )}

        {record.raw_text && (
          <div style={{
            marginBottom: 18,
            padding: 14,
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--color-border)',
            background: 'var(--color-surface-2)',
            whiteSpace: 'pre-wrap',
            lineHeight: 1.8,
            fontSize: 13,
            wordBreak: 'break-word',
          }}>
            {record.raw_text}
          </div>
        )}

        <div style={{ display: 'flex', gap: 10 }}>
          <button
            onClick={() => {
              onAction(record, 'APPROVED');
              onClose();
            }}
            style={{
              flex: 1,
              height: 42,
              borderRadius: 'var(--radius-md)',
              border: 'none',
              background: 'var(--color-success)',
              color: 'white',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            ✓ موافقة
          </button>
          <button
            onClick={() => {
              onAction(record, 'REJECTED');
              onClose();
            }}
            style={{
              flex: 1,
              height: 42,
              borderRadius: 'var(--radius-md)',
              border: 'none',
              background: 'var(--color-danger)',
              color: 'white',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            ✕ رفض
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

function EmptySwipeState() {
  return (
    <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} style={{ textAlign: 'center', padding: 60 }}>
      <div style={{ fontSize: 64, marginBottom: 16 }}>🎉</div>
      <h3 style={{ color: 'var(--color-text)', margin: '0 0 8px' }}>لا توجد عقارات قيد الانتظار</h3>
      <p style={{ color: 'var(--color-text-muted)', margin: 0 }}>تمت مراجعة جميع العقارات</p>
    </motion.div>
  );
}

function ErrorState() {
  return (
    <div style={{ textAlign: 'center', padding: 60 }}>
      <div style={{ fontSize: 48, marginBottom: 16 }}>⚠️</div>
      <p style={{ color: 'var(--color-danger)' }}>خطأ في تحميل البيانات</p>
    </div>
  );
}

// ─── Week Picker (Wed → Tue) ─────────────────────────────────────────────────

const MONTHS_AR = ['يناير','فبراير','مارس','أبريل','مايو','يونيو','يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر'];
// Sun Mon Tue Wed Thu Fri Sat
const DAY_HEADERS = ['ح','ن','ث','ر','خ','ج','س'];

/** Returns the Wed–Tue range that contains `date`. */
function getWedTueRange(date: Date): { start: Date; end: Date } {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  // Days since the most recent Wednesday (Wed=0, Thu=1, Fri=2, Sat=3, Sun=4, Mon=5, Tue=6)
  const daysSinceWed = (d.getDay() + 4) % 7;
  const start = new Date(d);
  start.setDate(d.getDate() - daysSinceWed);
  const end = new Date(start);
  end.setDate(start.getDate() + 7); // exclusive: next Wed
  return { start, end };
}

function sameDay(a: Date, b: Date) {
  return a.getDate() === b.getDate() && a.getMonth() === b.getMonth() && a.getFullYear() === b.getFullYear();
}

function fmtShort(d: Date) {
  return `${d.getDate()} ${MONTHS_AR[d.getMonth()]}`;
}

const NAV_BTN: React.CSSProperties = {
  width: 24, height: 24, borderRadius: 7, border: '1px solid var(--color-border)',
  background: 'transparent', color: 'var(--color-text-muted)',
  cursor: 'pointer', fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'center',
  transition: 'all 0.15s ease',
};

function WeekPicker({ value, onChange }: {
  value: { start: Date; end: Date } | null;
  onChange: (v: { start: Date; end: Date } | null) => void;
}) {
  const today = new Date();
  const [vm, setVm] = useState(today.getMonth());
  const [vy, setVy] = useState(today.getFullYear());
  const [hoverRange, setHoverRange] = useState<{ start: Date; end: Date } | null>(null);
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  function prevM() { if (vm === 0) { setVy(y => y - 1); setVm(11); } else setVm(m => m - 1); }
  function nextM() { if (vm === 11) { setVy(y => y + 1); setVm(0); } else setVm(m => m + 1); }

  // Build calendar grid (Sun-first)
  const cells: (Date | null)[] = [];
  const firstOfMonth = new Date(vy, vm, 1);
  for (let i = 0; i < firstOfMonth.getDay(); i++) cells.push(null);
  const daysInMonth = new Date(vy, vm + 1, 0).getDate();
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(vy, vm, d));
  while (cells.length % 7 !== 0) cells.push(null);

  const active = hoverRange ?? value;

  function handleClick(date: Date) {
    const range = getWedTueRange(date);
    onChange(value && sameDay(value.start, range.start) ? null : range);
  }

  // The inclusive end = exclusive end − 1 day
  const endInclusive = value ? new Date(value.end.getTime() - 86_400_000) : null;
  const rangeLabel = value && endInclusive
    ? `${fmtShort(value.start)} → ${fmtShort(endInclusive)}`
    : 'اختر أسبوعاً';

  useEffect(() => {
    function handleOutsideClick(event: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    window.addEventListener('mousedown', handleOutsideClick);
    return () => window.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  return (
    <div ref={rootRef} style={{ position: 'relative', width: 228 }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        style={{
          width: '100%',
          height: 42,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 8,
          borderRadius: 12,
          border: `1px solid ${open ? 'var(--color-accent)' : 'var(--color-border)'}`,
          background: open ? 'rgba(108,99,255,0.1)' : 'var(--color-surface)',
          padding: '0 10px 0 12px',
          cursor: 'pointer',
          transition: 'all 0.15s ease',
        }}
      >
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
          <span style={{
            width: 24,
            height: 24,
            borderRadius: 8,
            background: 'rgba(108,99,255,0.16)',
            color: 'var(--color-accent)',
            fontSize: 13,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>📅</span>
          <span style={{
            fontSize: 12,
            fontWeight: 600,
            color: value ? 'var(--color-text)' : 'var(--color-text-muted)',
            direction: 'ltr',
          }}>{rangeLabel}</span>
        </span>
        <span style={{
          fontSize: 14,
          color: 'var(--color-text-muted)',
          transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
          transition: 'transform 0.15s ease',
        }}>⌄</span>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.97 }}
            transition={{ duration: 0.14 }}
            dir="ltr"
            style={{
              position: 'absolute',
              top: 48,
              insetInlineStart: 0,
              width: 286,
              zIndex: 30,
              background: 'var(--color-surface)',
              border: '1px solid var(--color-border)',
              borderRadius: 14,
              overflow: 'hidden',
              userSelect: 'none',
              boxShadow: '0 20px 44px rgba(0,0,0,0.32)',
            }}
          >
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '9px 10px',
              borderBottom: '1px solid var(--color-border)',
              background: 'linear-gradient(180deg, rgba(108,99,255,0.08), rgba(108,99,255,0.02))',
            }}>
              <button style={NAV_BTN} onClick={prevM}>‹</button>
              <span style={{ fontWeight: 700, fontSize: 12, color: 'var(--color-text)', direction: 'rtl' }}>
                {MONTHS_AR[vm]} {vy}
              </span>
              <button style={NAV_BTN} onClick={nextM}>›</button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', padding: '6px 8px 3px' }}>
              {DAY_HEADERS.map((d, i) => (
                <div key={i} style={{
                  textAlign: 'center',
                  fontSize: 9,
                  fontWeight: 700,
                  color: i === 3 ? 'var(--color-accent)' : 'var(--color-text-muted)',
                }}>{d}</div>
              ))}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', padding: '0 8px 8px' }}>
              {cells.map((date, i) => {
                if (!date) return <div key={i} style={{ height: 28 }} />;

                const inRange = active ? date >= active.start && date < active.end : false;
                const isStart = active ? sameDay(date, active.start) : false;
                const isEnd = active && endInclusive ? sameDay(date, endInclusive) : false;
                const isToday = sameDay(date, today);
                const col = i % 7;
                const isFirstCol = col === 0;
                const isLastCol = col === 6;

                let br = '0';
                if (isStart) br = '7px 0 0 7px';
                else if (isEnd) br = '0 7px 7px 0';
                else if (inRange && isFirstCol) br = '7px 0 0 7px';
                else if (inRange && isLastCol) br = '0 7px 7px 0';

                const bg = (isStart || isEnd) ? 'var(--color-accent)'
                  : inRange ? 'rgba(108,99,255,0.14)'
                    : 'transparent';
                const color = (isStart || isEnd) ? 'white'
                  : inRange ? 'var(--color-accent)'
                    : isToday ? 'var(--color-accent)'
                      : 'var(--color-text)';
                const fw = (isStart || isEnd || isToday) ? 700 : 500;

                return (
                  <div
                    key={i}
                    onClick={() => {
                      handleClick(date);
                      setOpen(false);
                    }}
                    onMouseEnter={() => setHoverRange(getWedTueRange(date))}
                    onMouseLeave={() => setHoverRange(null)}
                    style={{
                      height: 28,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 11,
                      fontWeight: fw,
                      cursor: 'pointer',
                      background: bg,
                      color,
                      borderRadius: br,
                      position: 'relative',
                      transition: 'background 0.1s ease',
                    }}
                  >
                    {date.getDate()}
                    {isToday && !inRange && (
                      <span style={{
                        position: 'absolute',
                        bottom: 3,
                        left: '50%',
                        transform: 'translateX(-50%)',
                        width: 3,
                        height: 3,
                        borderRadius: '50%',
                        background: 'var(--color-accent)',
                      }} />
                    )}
                  </div>
                );
              })}
            </div>

            <div style={{
              borderTop: '1px solid var(--color-border)',
              padding: '8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 8,
              direction: 'rtl',
              background: 'var(--color-surface-2)',
            }}>
              <button
                onClick={() => {
                  onChange(getWedTueRange(today));
                  setOpen(false);
                }}
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  cursor: 'pointer',
                  borderRadius: 999,
                  padding: '4px 9px',
                  border: '1px solid rgba(108,99,255,0.35)',
                  background: 'rgba(108,99,255,0.08)',
                  color: 'var(--color-accent)',
                }}
              >هذا الأسبوع</button>
              <button
                onClick={() => onChange(null)}
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  cursor: 'pointer',
                  borderRadius: 999,
                  padding: '4px 9px',
                  border: '1px solid rgba(239,68,68,0.26)',
                  background: 'rgba(239,68,68,0.08)',
                  color: 'var(--color-danger)',
                }}
              >مسح</button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
