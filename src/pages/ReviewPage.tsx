import { useState } from 'react';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import Layout from '../components/Layout';
import SwipeCard from '../components/SwipeCard';
import StatusBadge from '../components/StatusBadge';
import Skeleton from '../components/Skeleton';
import { useRecords, useUpdateRecord } from '../hooks/useRecords';
import type { PropertyRecord } from '../api/records';

type FilterStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'ALL';

const FILTER_CHIPS: { label: string; value: FilterStatus }[] = [
  { label: 'قيد الانتظار', value: 'PENDING' },
  { label: 'موافق عليه', value: 'APPROVED' },
  { label: 'مرفوض', value: 'REJECTED' },
  { label: 'الكل', value: 'ALL' },
];

export default function ReviewPage() {
  const { data: records, isLoading, isError } = useRecords();
  const updateRecord = useUpdateRecord();
  const [filter, setFilter] = useState<FilterStatus>('PENDING');
  const [history, setHistory] = useState<{ id: number; prevStatus: 'APPROVED' | 'REJECTED' | null }[]>([]);

  const filteredRecords = (records ?? []).filter((r) => {
    if (filter === 'PENDING') return r.Status === null;
    if (filter === 'APPROVED') return r.Status === 'APPROVED';
    if (filter === 'REJECTED') return r.Status === 'REJECTED';
    return true;
  });

  const swipeableRecords = (records ?? []).filter((r) => r.Status === null);
  const currentCard = swipeableRecords[0];

  function handleAction(record: PropertyRecord, status: 'APPROVED' | 'REJECTED') {
    setHistory((h) => [{ id: record.id, prevStatus: record.Status }, ...h.slice(0, 9)]);
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

  const pendingCount = (records ?? []).filter((r) => r.Status === null).length;
  const totalCount = records?.length ?? 0;

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

        {filter === 'PENDING' && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 32 }}>
            {isLoading ? (
              <div style={{ width: '100%', maxWidth: 480 }}><Skeleton height={400} /></div>
            ) : isError ? (
              <ErrorState />
            ) : swipeableRecords.length === 0 ? (
              <EmptySwipeState />
            ) : (
              <>
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
              </>
            )}
          </div>
        )}

        {filter !== 'PENDING' && (
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
                  <RecordRow key={record.id} record={record} onAction={handleAction} />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </Layout>
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

function RecordRow({ record, onAction }: { record: PropertyRecord; onAction: (r: PropertyRecord, s: 'APPROVED' | 'REJECTED') => void }) {
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
      style={{
        background: 'var(--color-surface)', border: '1px solid var(--color-border)',
        borderRadius: 'var(--radius-lg)', padding: '16px 20px',
        display: 'flex', alignItems: 'center', gap: 16,
      }}
    >
      <div style={{ flex: 1 }}>
        <p style={{ margin: 0, fontWeight: 600, fontSize: 15 }}>{record.location}</p>
        <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--color-text-muted)' }}>
          {record.city} &bull; {record.price} {record.currency}
        </p>
      </div>
      <StatusBadge status={record.Status} size="sm" />
      <div style={{ display: 'flex', gap: 8 }}>
        <SmallBtn label="موافقة" color="var(--color-success)" onClick={() => onAction(record, 'APPROVED')} />
        <SmallBtn label="رفض" color="var(--color-danger)" onClick={() => onAction(record, 'REJECTED')} />
      </div>
    </motion.div>
  );
}

function SmallBtn({ label, color, onClick }: { label: string; color: string; onClick: () => void }) {
  return (
    <button onClick={onClick} style={{
      padding: '4px 12px', borderRadius: 6, border: `1px solid ${color}`,
      background: 'transparent', color, fontSize: 12, cursor: 'pointer', transition: 'all 0.15s ease',
    }}>{label}</button>
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
