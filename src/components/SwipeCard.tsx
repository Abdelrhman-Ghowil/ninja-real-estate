import { useState } from 'react';
import { motion, useMotionValue, useTransform, AnimatePresence } from 'framer-motion';
import type { PropertyRecord } from '../api/records';
import StatusBadge from './StatusBadge';
import { formatPrice, formatArea, formatDate } from '../utils/format';
import { loadScoringSettings, scoreRecord, type ScoreCriterion } from '../utils/recordScoring';

interface Props {
  record: PropertyRecord;
  onApprove: () => void;
  onReject: () => void;
  isTop: boolean;
}

const SWIPE_THRESHOLD = 100;

export default function SwipeCard({ record, onApprove, onReject, isTop }: Props) {
  const [showRaw, setShowRaw] = useState(false);
  const [showScoreDetails, setShowScoreDetails] = useState(false);
  const score = scoreRecord(record, loadScoringSettings());
  const x = useMotionValue(0);
  const rotate = useTransform(x, [-200, 200], [-20, 20]);
  const approveOpacity = useTransform(x, [0, SWIPE_THRESHOLD], [0, 1]);
  const rejectOpacity = useTransform(x, [-SWIPE_THRESHOLD, 0], [1, 0]);

  function handleDragEnd(_e: unknown, info: { offset: { x: number } }) {
    if (info.offset.x > SWIPE_THRESHOLD) onApprove();
    else if (info.offset.x < -SWIPE_THRESHOLD) onReject();
  }

  return (
    <motion.div
      style={{
        x,
        rotate,
        position: 'absolute',
        width: '100%',
        maxWidth: 480,
        cursor: isTop ? 'grab' : 'default',
        touchAction: 'none',
        userSelect: 'none',
      }}
      drag={isTop ? 'x' : false}
      dragConstraints={{ left: 0, right: 0 }}
      onDragEnd={handleDragEnd}
      whileDrag={{ cursor: 'grabbing' }}
    >
      {/* Approve label */}
      {isTop && (
        <motion.div
          style={{
            position: 'absolute', top: 24, left: 24, zIndex: 10,
            background: 'var(--color-success)', color: 'white',
            padding: '8px 20px', borderRadius: 8, fontWeight: 700, fontSize: 18,
            opacity: approveOpacity, rotate: -15, pointerEvents: 'none',
          }}
        >
          موافقة
        </motion.div>
      )}

      {/* Reject label */}
      {isTop && (
        <motion.div
          style={{
            position: 'absolute', top: 24, right: 24, zIndex: 10,
            background: 'var(--color-danger)', color: 'white',
            padding: '8px 20px', borderRadius: 8, fontWeight: 700, fontSize: 18,
            opacity: rejectOpacity, rotate: 15, pointerEvents: 'none',
          }}
        >
          رفض
        </motion.div>
      )}

      <div
        dir="rtl"
        style={{
          background: 'var(--color-surface)',
          border: '1px solid var(--color-border)',
          borderRadius: 'var(--radius-xl)',
          padding: 28,
          boxShadow: isTop
            ? '0 20px 60px rgba(0,0,0,0.5), 0 0 0 1px rgba(108,99,255,0.1)'
            : '0 8px 24px rgba(0,0,0,0.3)',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: 'var(--color-text)', lineHeight: 1.3 }}>
              {record.location}
            </h2>
            <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--color-text-muted)' }}>
              {record.city} &bull; {record.region}
            </p>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8 }}>
            <StatusBadge status={record.Status} />
            <button
              type="button"
              onPointerDown={(event) => event.stopPropagation()}
              onClick={(event) => {
                event.stopPropagation();
                setShowScoreDetails(true);
              }}
              style={{
                padding: '6px 10px',
                borderRadius: 10,
                border: '1px solid rgba(108,99,255,0.35)',
                background: 'rgba(108,99,255,0.12)',
                color: 'var(--color-accent)',
                fontSize: 12,
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              Score {score.totalScore}/{score.maxScore} • {score.percentage}%
            </button>
          </div>
        </div>

        {/* Info grid */}
        <div style={{
          display: 'grid', gridTemplateColumns: '1fr 1fr',
          gap: 12, marginBottom: 20,
        }}>
          <InfoCard label="السعر" value={formatPrice(record.price, record.currency)} accent />
          <InfoCard label="المساحة" value={formatArea(record.area_m2)} />
          <InfoCard label="مدة العقد" value={`${record.contract_duration_years} سنة`} />
          <InfoCard label="حالة البناء" value={record.building_status} />
          <InfoCard
            label="الاكتمال المتوقع"
            value={`${record.expected_completion_min_months}–${record.expected_completion_max_months} أشهر`}
          />
          <InfoCard label="تاريخ الإضافة" value={formatDate(record.createdAt)} />
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

        {/* Raw text toggle */}
        {record.raw_text && (
          <div>
            <button
              onClick={() => setShowRaw(!showRaw)}
              style={{
                width: '100%',
                padding: '10px 16px',
                background: 'var(--color-surface-2)',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-md)',
                color: 'var(--color-text-muted)',
                cursor: 'pointer',
                fontSize: 13,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                transition: 'all 0.15s ease',
              }}
            >
              <span>النص الأصلي</span>
              <span style={{ transform: showRaw ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s', display: 'inline-block' }}>&#9660;</span>
            </button>
            <AnimatePresence>
              {showRaw && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  style={{ overflow: 'hidden' }}
                >
                  <div style={{
                    marginTop: 8,
                    padding: 16,
                    background: 'var(--color-surface-2)',
                    border: '1px solid var(--color-border)',
                    borderRadius: 'var(--radius-md)',
                    fontSize: 13,
                    color: 'var(--color-text)',
                    lineHeight: 1.8,
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                    maxHeight: 200,
                    overflowY: 'auto',
                  }}>
                    {record.raw_text}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}
      </div>

      <AnimatePresence>
        {showScoreDetails && (
          <ScoreBreakdownModal
            record={record}
            score={score}
            onClose={() => setShowScoreDetails(false)}
          />
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function InfoCard({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div style={{
      background: 'var(--color-surface-2)',
      border: '1px solid var(--color-border)',
      borderRadius: 'var(--radius-md)',
      padding: '12px 14px',
    }}>
      <p style={{ margin: 0, fontSize: 11, color: 'var(--color-text-muted)', fontWeight: 500 }}>{label}</p>
      <p style={{
        margin: '4px 0 0',
        fontSize: accent ? 16 : 14,
        fontWeight: accent ? 700 : 500,
        color: accent ? 'var(--color-accent)' : 'var(--color-text)',
      }}>{value}</p>
    </div>
  );
}

function ScoreBreakdownModal({
  record,
  score,
  onClose,
}: {
  record: PropertyRecord;
  score: ReturnType<typeof scoreRecord>;
  onClose: () => void;
}) {
  const numeratorText = score.criteria.map((item) => `(${item.score}×${formatWeight(item.weight)})`).join(' + ');
  const denominatorText = score.criteria.map((item) => `(${item.max}×${formatWeight(item.weight)})`).join(' + ');

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(5, 8, 20, 0.78)',
        backdropFilter: 'blur(6px)',
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
      }}
    >
      <motion.div
        initial={{ opacity: 0, y: 16, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 12, scale: 0.98 }}
        transition={{ duration: 0.2 }}
        onClick={(event) => event.stopPropagation()}
        dir="rtl"
        style={{
          width: 'min(920px, 100%)',
          maxHeight: 'min(88vh, 820px)',
          overflowY: 'auto',
          borderRadius: 'var(--radius-xl)',
          border: '1px solid rgba(255,255,255,0.08)',
          background: '#0b1020',
          color: '#f8fafc',
          padding: 24,
          boxShadow: '0 28px 80px rgba(0,0,0,0.45)',
          display: 'grid',
          gap: 18,
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
          <div>
            <p style={{ margin: 0, fontSize: 12, color: 'rgba(248,250,252,0.65)', fontWeight: 700 }}>تفصيل حساب الدرجة</p>
            <h3 style={{ margin: '6px 0 0', fontSize: 22, fontWeight: 800, lineHeight: 1.3 }}>{record.location || 'العقار'}</h3>
            <p style={{ margin: '6px 0 0', fontSize: 13, color: 'rgba(248,250,252,0.68)' }}>
              {record.city || '—'} • {record.region || '—'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              width: 38,
              height: 38,
              borderRadius: 999,
              border: '1px solid rgba(255,255,255,0.12)',
              background: 'rgba(255,255,255,0.06)',
              color: '#fff',
              fontSize: 18,
              cursor: 'pointer',
            }}
          >
            ×
          </button>
        </div>

        <div style={{
          borderRadius: 24,
          border: '1px solid rgba(255,255,255,0.16)',
          background: 'linear-gradient(180deg, rgba(76,29,52,0.86), rgba(67,30,54,0.7))',
          padding: '20px 24px',
          textAlign: 'center',
          fontSize: 18,
          fontWeight: 700,
          lineHeight: 1.9,
          overflowX: 'auto',
        }}>
          Final Score (%) = Σ(Scoreᵢ × Weightᵢ) ÷ Σ(Max Score × Weightᵢ) × 100
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
          gap: 16,
          alignItems: 'start',
        }}>
          <div style={{
            borderRadius: 'var(--radius-xl)',
            border: '1px solid rgba(255,255,255,0.12)',
            background: 'rgba(15,23,42,0.88)',
            padding: 18,
            display: 'grid',
            gap: 12,
          }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 0.8fr 0.8fr 1fr', gap: 8, fontSize: 12, color: 'rgba(248,250,252,0.7)', fontWeight: 700 }}>
              <span>المعيار</span>
              <span style={{ textAlign: 'center' }}>النتيجة</span>
              <span style={{ textAlign: 'center' }}>الوزن</span>
              <span style={{ textAlign: 'center' }}>الناتج</span>
            </div>
            {score.criteria.map((criterion) => (
              <div
                key={criterion.key}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1.4fr 0.8fr 0.8fr 1fr',
                  gap: 8,
                  alignItems: 'center',
                  padding: '10px 12px',
                  borderRadius: 14,
                  background: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(255,255,255,0.06)',
                }}
              >
                <div>
                  <p style={{ margin: 0, fontSize: 13, fontWeight: 700 }}>{getCriterionTitle(criterion)}</p>
                  <p style={{ margin: '3px 0 0', fontSize: 11, color: 'rgba(248,250,252,0.64)' }}>{criterion.value}</p>
                </div>
                <span style={{ textAlign: 'center', fontSize: 15, fontWeight: 800 }}>{criterion.score}</span>
                <span style={{ textAlign: 'center', fontSize: 14, fontWeight: 700, color: '#c4b5fd' }}>{formatWeight(criterion.weight)}</span>
                <span style={{ textAlign: 'center', fontSize: 14, fontWeight: 800, color: '#facc15' }}>
                  {formatWeightedValue(criterion.weightedScore)}
                </span>
              </div>
            ))}
          </div>

          <div style={{ display: 'grid', gap: 14 }}>
            <div style={{
              borderRadius: 'var(--radius-xl)',
              border: '1px solid rgba(255,255,255,0.12)',
              background: 'rgba(15,23,42,0.88)',
              padding: 18,
              display: 'grid',
              gap: 12,
            }}>
              <p style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>المعادلة على هذا العقار</p>
              <div style={{ fontSize: 14, lineHeight: 1.9, color: 'rgba(248,250,252,0.84)' }}>
                <div>{numeratorText}</div>
                <div style={{ opacity: 0.75 }}>────────────────────────</div>
                <div>{denominatorText}</div>
              </div>
              <div style={{
                borderRadius: 16,
                background: 'rgba(250,204,21,0.08)',
                border: '1px solid rgba(250,204,21,0.22)',
                padding: 14,
                display: 'grid',
                gap: 8,
              }}>
                <div style={{ fontSize: 14, color: 'rgba(248,250,252,0.78)' }}>
                  المجموع الموزون = {formatWeightedValue(score.weightedScore)}
                </div>
                <div style={{ fontSize: 14, color: 'rgba(248,250,252,0.78)' }}>
                  الحد الأقصى الموزون = {formatWeightedValue(score.weightedMax)}
                </div>
                <div style={{ fontSize: 22, fontWeight: 900, color: '#facc15' }}>
                  النتيجة النهائية = {score.weightedPercentage}%
                </div>
              </div>
            </div>

            <div style={{
              borderRadius: 'var(--radius-xl)',
              border: '1px solid rgba(255,255,255,0.12)',
              background: 'rgba(15,23,42,0.88)',
              padding: 18,
              display: 'grid',
              gap: 10,
            }}>
              <p style={{ margin: 0, fontSize: 16, fontWeight: 800 }}>النتيجة المعروضة حالياً</p>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <StatPill label="النقاط" value={`${score.totalScore}/${score.maxScore}`} />
                <StatPill label="النسبة الحالية" value={`${score.percentage}%`} />
                <StatPill label="النسبة الموزونة" value={`${score.weightedPercentage}%`} accent />
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

function getCriterionTitle(criterion: ScoreCriterion): string {
  const labels: Record<ScoreCriterion['key'], string> = {
    distance: 'المسافة',
    size: 'المساحة',
    height: 'الارتفاع',
    price: 'السعر',
    contract: 'العقد',
    status: 'الحالة',
  };
  return labels[criterion.key];
}

function formatWeight(value: number): string {
  return value.toFixed(2);
}

function formatWeightedValue(value: number): string {
  return value.toFixed(2).replace(/\.00$/, '');
}

function StatPill({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div style={{
      minWidth: 120,
      padding: '10px 12px',
      borderRadius: 14,
      border: accent ? '1px solid rgba(250,204,21,0.26)' : '1px solid rgba(255,255,255,0.1)',
      background: accent ? 'rgba(250,204,21,0.08)' : 'rgba(255,255,255,0.04)',
      display: 'grid',
      gap: 4,
    }}>
      <span style={{ fontSize: 11, color: 'rgba(248,250,252,0.66)', fontWeight: 700 }}>{label}</span>
      <span style={{ fontSize: 17, fontWeight: 800, color: accent ? '#facc15' : '#fff' }}>{value}</span>
    </div>
  );
}
