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

interface ChatMsg {
  id: string;
  role: 'user' | 'agent';
  text: string;
  ts: Date;
}

const QUICK_REPLIES = [
  'كيف أرسل عقاراً؟',
  'ما هي المناطق المتاحة؟',
  'كيف يتم التقييم؟',
  'مميزات المنصة',
];

function parseReply(data: unknown): string {
  if (typeof data === 'string') return data;
  if (Array.isArray(data) && data.length > 0) return parseReply(data[0]);
  if (data && typeof data === 'object') {
    const o = data as Record<string, unknown>;
    const val = o.output ?? o.reply ?? o.message ?? o.text ?? o.content ?? o.response ?? o.answer;
    if (val) return String(val);
  }
  return 'عذراً، لم أستطع فهم الرد. حاول مرة أخرى.';
}

function useChatSession() {
  const BASE_URL = import.meta.env.VITE_API_BASE_URL as string;

  const sessionId = useMemo(() => {
    const key = 'ninja-chat-sid';
    const stored = sessionStorage.getItem(key);
    if (stored) return stored;
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    sessionStorage.setItem(key, id);
    return id;
  }, []);

  const [msgs, setMsgs] = useState<ChatMsg[]>([{
    id: 'welcome',
    role: 'agent',
    text: 'أهلاً بك في Ninja Real Estate! 🏠\nأنا مساعدك الذكي، يمكنني مساعدتك في تقييم العقارات والإجابة على استفساراتك. بماذا أخدمك؟',
    ts: new Date(),
  }]);
  const [loading, setLoading] = useState(false);
  const [showQuick, setShowQuick] = useState(true);

  async function send(text: string) {
    if (!text.trim() || loading) return;
    setShowQuick(false);
    setMsgs(prev => [...prev, { id: `u-${Date.now()}`, role: 'user', text: text.trim(), ts: new Date() }]);
    setLoading(true);
    try {
      const res = await fetch(`${BASE_URL}/webhook/chatbot`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text.trim(), sessionId }),
      });
      const data = await res.json();
      setMsgs(prev => [...prev, { id: `a-${Date.now()}`, role: 'agent', text: parseReply(data), ts: new Date() }]);
    } catch {
      setMsgs(prev => [...prev, { id: `err-${Date.now()}`, role: 'agent', text: 'تعذّر الاتصال بالخادم. تحقق من الاتصال وحاول مرة أخرى.', ts: new Date() }]);
    } finally {
      setLoading(false);
    }
  }

  return { msgs, loading, send, showQuick };
}

export default function ReviewPage() {
  const { data: records, isLoading, isError } = useRecords();
  const updateRecord = useUpdateRecord();
  const [filter, setFilter] = useState<FilterStatus>('PENDING');
  const [nameFilter, setNameFilter] = useState('');
  const [weekRange, setWeekRange] = useState<{ start: Date; end: Date } | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [history, setHistory] = useState<{ id: number; prevStatus: 'APPROVED' | 'REJECTED' | null }[]>([]);
  const [selectedRecord, setSelectedRecord] = useState<PropertyRecord | null>(null);
  const [comparisonMode, setComparisonMode] = useState(false);
  const [comparisonIds, setComparisonIds] = useState<number[]>([]);

  const normalizedNameFilter = nameFilter.trim().toLowerCase();

  const matchesAdvancedFilters = (record: PropertyRecord) => {
    const matchesName = !normalizedNameFilter || [
      record.location,
      record.city,
      record.region,
      record.raw_text,
    ].some((field) => field?.toLowerCase().includes(normalizedNameFilter));

    if (!weekRange) return matchesName;
    const createdAt = new Date(record.createdAt);
    if (Number.isNaN(createdAt.getTime())) return false;
    return matchesName && createdAt >= weekRange.start && createdAt < weekRange.end;
  };

  const allRecords = records ?? [];

  const filteredRecords = allRecords.filter((r) => {
    const status = normalizeStatus(r.Status);
    if (filter === 'PENDING') return status === null;
    if (filter === 'APPROVED') return status === 'APPROVED' && matchesAdvancedFilters(r);
    if (filter === 'REJECTED') return status === 'REJECTED' && matchesAdvancedFilters(r);
    return matchesAdvancedFilters(r);
  });

  const swipeableRecords = allRecords.filter((r) => normalizeStatus(r.Status) === null && matchesAdvancedFilters(r));
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

  function handleAction(record: PropertyRecord, status: 'APPROVED' | 'REJECTED') {
    setHistory((h) => [{ id: record.id, prevStatus: normalizeStatus(record.Status) }, ...h.slice(0, 9)]);
    updateRecord.mutate({ id: record.id, data: { Status: status } });
    toast.success(status === 'APPROVED' ? 'تمت الموافقة' : 'تم الرفض', { duration: 2000 });
  }

  function handleUndo() {
    const last = history[0];
    if (!last) return;
    setHistory((h) => h.slice(1));
    updateRecord.mutate({ id: last.id, data: { Status: last.prevStatus } });
    toast.info('تم التراجع');
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
                display: 'grid',
                gridTemplateColumns: 'minmax(280px, 1fr) auto',
                gap: 10,
                alignItems: 'start',
              }}
            >
              <input
                className="input-field"
                placeholder="🔍  فلترة بالاسم أو المدينة أو المنطقة..."
                value={nameFilter}
                onChange={(e) => setNameFilter(e.target.value)}
                style={{ minHeight: 42 }}
              />
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, direction: 'ltr' }}>
                <button
                  type="button"
                  onClick={clearAdvancedFilters}
                  disabled={!nameFilter.trim() && !weekRange}
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
                    cursor: !nameFilter.trim() && !weekRange ? 'not-allowed' : 'pointer',
                    opacity: !nameFilter.trim() && !weekRange ? 0.5 : 1,
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  ×
                </button>
                <WeekPicker value={weekRange} onChange={setWeekRange} />
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
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                gap: 10,
                alignItems: 'stretch',
              }}>
                {comparisonRecords.map((record) => (
                  <CompareRecordCard key={record.id} record={record} onOpen={() => setSelectedRecord(record)} />
                ))}
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
              <div style={{
                width: '100%',
                maxWidth: 1120,
                display: 'flex',
                flexWrap: 'wrap',
                gap: 20,
                alignItems: 'flex-start',
                justifyContent: 'center',
                direction: 'ltr',
              }}>
                <motion.div
                  initial={{ opacity: 0, x: -12 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.22 }}
                  style={{
                    flex: '1 1 360px',
                    minWidth: 320,
                    maxWidth: 560,
                    background: 'linear-gradient(180deg, rgba(108,99,255,0.14), rgba(108,99,255,0.04))',
                    border: '1px solid rgba(108,99,255,0.3)',
                    borderRadius: 'var(--radius-xl)',
                    padding: 16,
                    direction: 'rtl',
                  }}
                >
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
                </motion.div>
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
                    <button onClick={handleUndo} disabled={history.length === 0}
                      style={{
                        width: 44, height: 44, borderRadius: '50%',
                        border: '1px solid var(--color-border)', background: 'var(--color-surface)',
                        color: history.length > 0 ? 'var(--color-text-muted)' : 'var(--color-border)',
                        cursor: history.length > 0 ? 'pointer' : 'not-allowed',
                        fontSize: 18, display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontWeight: 700, transition: 'all 0.15s ease',
                      }} title="تراجع">
                      ↺
                    </button>
                    <ActionButton label="موافقة" icon="✓" color="var(--color-success)"
                      onClick={() => currentCard && handleAction(currentCard, 'APPROVED')} />
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
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [hasUnread, setHasUnread] = useState(true);
  const { msgs, loading, send, showQuick } = useChatSession();
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 80);
      setTimeout(() => inputRef.current?.focus(), 120);
    }
  }, [open]);

  useEffect(() => {
    if (open) {
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 60);
    }
  }, [msgs, loading, open]);

  function handleSend() {
    const text = input.trim();
    if (!text || loading) return;
    setInput('');
    send(text);
  }

  function handleKey(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
  }

  function fmtTime(d: Date) {
    return d.toLocaleTimeString('ar', { hour: '2-digit', minute: '2-digit' });
  }

  return (
    <>
      <style>{`
        @keyframes pulse-ring {
          0% { transform: scale(1); opacity: 0.6; }
          100% { transform: scale(1.55); opacity: 0; }
        }
        @keyframes dot-bounce {
          0%, 60%, 100% { transform: translateY(0); }
          30% { transform: translateY(-5px); }
        }
        .chat-input:focus { outline: none; border-color: var(--color-accent) !important; }
        .chat-send:hover { background: #5a52e0 !important; }
        .quick-chip:hover { background: rgba(108,99,255,0.2) !important; border-color: var(--color-accent) !important; }
      `}</style>
      <div style={{ position: 'fixed', bottom: 24, right: 24, zIndex: 200, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 12 }}>
        <AnimatePresence>
          {open && (
            <motion.div
              key="panel"
              initial={{ opacity: 0, scale: 0.85, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.85, y: 20 }}
              transition={{ type: 'spring', stiffness: 360, damping: 28 }}
              dir="rtl"
              style={{
                width: 'min(380px, calc(100vw - 48px))',
                height: 'min(520px, calc(100vh - 120px))',
                background: 'var(--color-surface)',
                border: '1px solid var(--color-border)',
                borderRadius: 20,
                boxShadow: '0 32px 80px rgba(0,0,0,0.5), 0 0 0 1px rgba(108,99,255,0.1)',
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden',
                transformOrigin: 'bottom right',
              }}
            >
              <div style={{
                background: 'linear-gradient(135deg, var(--color-accent) 0%, #a78bfa 100%)',
                padding: '16px 18px',
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                flexShrink: 0,
              }}>
                <div style={{
                  width: 42, height: 42, borderRadius: '50%',
                  background: 'rgba(255,255,255,0.2)',
                  border: '2px solid rgba(255,255,255,0.35)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 20, flexShrink: 0,
                }}>🤖</div>
                <div style={{ flex: 1 }}>
                  <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: 'white' }}>مساعد Ninja الذكي</p>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 2 }}>
                    <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#4ade80', boxShadow: '0 0 6px #4ade80' }} />
                    <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.8)' }}>متصل الآن</span>
                  </div>
                </div>
                <button onClick={() => setOpen(false)} style={{
                  width: 30, height: 30, borderRadius: '50%',
                  background: 'rgba(255,255,255,0.15)', border: 'none',
                  color: 'white', cursor: 'pointer', fontSize: 14,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0,
                }}>✕</button>
              </div>
              <div style={{
                flex: 1,
                overflowY: 'auto',
                padding: '16px 14px',
                display: 'flex',
                flexDirection: 'column',
                gap: 10,
                scrollbarWidth: 'thin',
                scrollbarColor: 'var(--color-border) transparent',
              }}>
                {msgs.map(msg => (
                  <motion.div
                    key={msg.id}
                    initial={{ opacity: 0, y: 8, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    transition={{ duration: 0.2 }}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: msg.role === 'agent' ? 'flex-start' : 'flex-end',
                      gap: 4,
                    }}
                  >
                    <div style={{
                      maxWidth: '82%',
                      padding: '10px 14px',
                      borderRadius: msg.role === 'agent'
                        ? '4px 16px 16px 16px'
                        : '16px 4px 16px 16px',
                      background: msg.role === 'agent'
                        ? 'var(--color-surface-2)'
                        : 'linear-gradient(135deg, var(--color-accent), #a78bfa)',
                      color: msg.role === 'agent' ? 'var(--color-text)' : 'white',
                      fontSize: 13,
                      lineHeight: 1.65,
                      whiteSpace: 'pre-wrap',
                      wordBreak: 'break-word',
                      border: msg.role === 'agent' ? '1px solid var(--color-border)' : 'none',
                      boxShadow: msg.role === 'user' ? '0 4px 12px rgba(108,99,255,0.3)' : 'none',
                    }}>
                      {msg.text}
                    </div>
                    <span style={{ fontSize: 10, color: 'var(--color-text-muted)', padding: '0 4px' }}>
                      {fmtTime(msg.ts)}
                    </span>
                  </motion.div>
                ))}
                <AnimatePresence>
                  {loading && (
                    <motion.div
                      initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                      style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}
                    >
                      <div style={{
                        padding: '12px 16px',
                        borderRadius: '4px 16px 16px 16px',
                        background: 'var(--color-surface-2)',
                        border: '1px solid var(--color-border)',
                        display: 'flex', gap: 5, alignItems: 'center',
                      }}>
                        {[0, 1, 2].map(i => (
                          <div key={i} style={{
                            width: 7, height: 7, borderRadius: '50%',
                            background: 'var(--color-accent)',
                            animation: `dot-bounce 1.2s ease-in-out ${i * 0.15}s infinite`,
                          }} />
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
                <AnimatePresence>
                  {showQuick && !loading && (
                    <motion.div
                      initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, height: 0 }}
                      style={{ display: 'flex', flexWrap: 'wrap', gap: 6, paddingTop: 4 }}
                    >
                      {QUICK_REPLIES.map(q => (
                        <button
                          key={q}
                          className="quick-chip"
                          onClick={() => send(q)}
                          style={{
                            padding: '6px 12px', borderRadius: 100, cursor: 'pointer',
                            border: '1px solid var(--color-border)',
                            background: 'rgba(108,99,255,0.08)',
                            color: 'var(--color-accent)',
                            fontSize: 11, fontWeight: 600, fontFamily: 'inherit',
                            transition: 'all 0.15s ease',
                          }}
                        >{q}</button>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
                <div ref={bottomRef} />
              </div>
              <div style={{
                padding: '12px 14px',
                borderTop: '1px solid var(--color-border)',
                display: 'flex',
                gap: 8,
                flexShrink: 0,
                background: 'var(--color-surface)',
              }}>
                <input
                  ref={inputRef}
                  className="chat-input"
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={handleKey}
                  placeholder="اكتب رسالتك..."
                  disabled={loading}
                  style={{
                    flex: 1,
                    padding: '10px 14px',
                    borderRadius: 12,
                    border: '1.5px solid var(--color-border)',
                    background: 'var(--color-surface-2)',
                    color: 'var(--color-text)',
                    fontSize: 13,
                    fontFamily: 'inherit',
                    direction: 'rtl',
                    transition: 'border-color 0.15s ease',
                  }}
                />
                <motion.button
                  className="chat-send"
                  onClick={handleSend}
                  disabled={!input.trim() || loading}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.93 }}
                  style={{
                    width: 42, height: 42, borderRadius: 12, flexShrink: 0,
                    background: (!input.trim() || loading) ? 'var(--color-surface-2)' : 'var(--color-accent)',
                    border: 'none',
                    color: (!input.trim() || loading) ? 'var(--color-text-muted)' : 'white',
                    cursor: (!input.trim() || loading) ? 'not-allowed' : 'pointer',
                    fontSize: 16,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    transition: 'all 0.15s ease',
                  }}
                  aria-label="إرسال"
                >
                  ←
                </motion.button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        <div style={{ position: 'relative' }}>
          {!open && (
            <div style={{
              position: 'absolute', inset: 0, borderRadius: '50%',
              background: 'var(--color-accent)',
              animation: 'pulse-ring 2s ease-out infinite',
            }} />
          )}
          <motion.button
            onClick={() => {
              setOpen((prev) => {
                const next = !prev;
                if (next) setHasUnread(false);
                return next;
              });
            }}
            whileHover={{ scale: 1.08 }}
            whileTap={{ scale: 0.92 }}
            title={open ? 'إغلاق المحادثة' : 'تحدث مع مساعدنا'}
            style={{
              position: 'relative',
              width: 58, height: 58, borderRadius: '50%',
              background: open
                ? 'var(--color-surface-2)'
                : 'linear-gradient(135deg, var(--color-accent) 0%, #a78bfa 100%)',
              border: open ? '1.5px solid var(--color-border)' : 'none',
              color: 'white',
              cursor: 'pointer',
              fontSize: open ? 20 : 26,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: open ? 'none' : '0 8px 24px rgba(108,99,255,0.45)',
              transition: 'background 0.2s ease, box-shadow 0.2s ease',
            }}
          >
            <AnimatePresence mode="wait">
              <motion.span
                key={open ? 'close' : 'open'}
                initial={{ scale: 0.5, rotate: -90, opacity: 0 }}
                animate={{ scale: 1, rotate: 0, opacity: 1 }}
                exit={{ scale: 0.5, rotate: 90, opacity: 0 }}
                transition={{ duration: 0.18 }}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
                {open ? '✕' : '💬'}
              </motion.span>
            </AnimatePresence>
            <AnimatePresence>
              {hasUnread && !open && (
                <motion.div
                  initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}
                  style={{
                    position: 'absolute', top: 2, left: 2,
                    width: 18, height: 18, borderRadius: '50%',
                    background: '#ef4444',
                    border: '2px solid var(--color-bg)',
                    fontSize: 10, fontWeight: 700, color: 'white',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}
                >1</motion.div>
              )}
            </AnimatePresence>
          </motion.button>
        </div>
      </div>
    </>
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

function CompareRecordCard({
  record,
  onOpen,
}: {
  record: PropertyRecord;
  onOpen: () => void;
}) {
  const score = scoreRecord(record, loadScoringSettings());
  const completion = record.expected_completion_min_months || record.expected_completion_max_months
    ? `${record.expected_completion_min_months || '—'}-${record.expected_completion_max_months || '—'} mo`
    : '—';

  const compactFields: [string, string][] = [
    ['Final score', `${score.totalScore}/${score.maxScore} (${score.percentage}%)`],
    ['Status', normalizeStatus(record.Status) ?? 'PENDING'],
    ['Price', `${record.price || '—'} ${record.currency || ''}`.trim()],
    ['Area', record.area_m2 ? `${record.area_m2} m²` : '—'],
    ['Contract', record.contract_duration_years ? `${record.contract_duration_years} yrs` : '—'],
    ['Build', record.building_status || '—'],
    ['ETA', completion],
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      style={{
        border: '1px solid var(--color-border)',
        borderRadius: 'var(--radius-lg)',
        background: 'var(--color-surface)',
        padding: 10,
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        minHeight: 260,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <StatusBadge status={normalizeStatus(record.Status)} size="sm" />
          <span style={{
            padding: '4px 8px',
            borderRadius: 999,
            border: '1px solid rgba(108,99,255,0.35)',
            background: 'rgba(108,99,255,0.12)',
            color: 'var(--color-accent)',
            fontSize: 10,
            fontWeight: 700,
          }}>
            {score.totalScore}/{score.maxScore}
          </span>
        </div>
        <button
          type="button"
          onClick={onOpen}
          style={{
            padding: '5px 9px',
            borderRadius: 8,
            border: '1px solid var(--color-border)',
            background: 'var(--color-surface-2)',
            color: 'var(--color-text-muted)',
            fontSize: 11,
            fontWeight: 700,
            cursor: 'pointer',
          }}
        >
          Details
        </button>
      </div>

      <div>
        <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: 'var(--color-text)' }}>{record.location || 'No location'}</p>
        <p style={{ margin: '2px 0 0', fontSize: 11, color: 'var(--color-text-muted)' }}>
          {record.city || '—'} • {record.region || '—'}
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 6 }}>
        {compactFields.map(([label, value]) => (
          <div key={label} style={{
            border: '1px solid var(--color-border)',
            borderRadius: 8,
            background: 'var(--color-surface-2)',
            padding: '6px 8px',
          }}>
            <p style={{ margin: 0, fontSize: 10, color: 'var(--color-text-muted)' }}>{label}</p>
            <p style={{ margin: '2px 0 0', fontSize: 12, fontWeight: 600, color: 'var(--color-text)', wordBreak: 'break-word' }}>{value}</p>
          </div>
        ))}
      </div>
    </motion.div>
  );
}

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
