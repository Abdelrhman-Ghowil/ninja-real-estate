import { useState } from 'react';
import { motion, useMotionValue, useTransform, AnimatePresence } from 'framer-motion';
import type { PropertyRecord } from '../api/records';
import StatusBadge from './StatusBadge';
import { formatPrice, formatArea, formatDate } from '../utils/format';

interface Props {
  record: PropertyRecord;
  onApprove: () => void;
  onReject: () => void;
  isTop: boolean;
}

const SWIPE_THRESHOLD = 100;

export default function SwipeCard({ record, onApprove, onReject, isTop }: Props) {
  const [showRaw, setShowRaw] = useState(false);
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
          <StatusBadge status={record.Status} />
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
