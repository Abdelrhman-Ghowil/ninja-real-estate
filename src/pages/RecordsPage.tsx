import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import Layout from '../components/Layout';
import StatusBadge from '../components/StatusBadge';
import Skeleton from '../components/Skeleton';
import { useRecords, useUpdateRecord, useDeleteRecord } from '../hooks/useRecords';
import type { PropertyRecord } from '../api/records';
import { formatPrice, formatArea, formatDate } from '../utils/format';

type StatusFilter = 'ALL' | 'APPROVED' | 'REJECTED' | 'PENDING';

export default function RecordsPage() {
  const { data: records, isLoading, isError, refetch, isFetching } = useRecords();
  const updateRecord = useUpdateRecord();
  const deleteRecord = useDeleteRecord();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL');
  const [selectedRecord, setSelectedRecord] = useState<PropertyRecord | null>(null);

  const filtered = useMemo(() => {
    let list = records ?? [];
    if (statusFilter !== 'ALL') {
      const s = statusFilter === 'PENDING' ? null : statusFilter;
      list = list.filter((r) => r.Status === s);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (r) =>
          r.location.toLowerCase().includes(q) ||
          r.city.toLowerCase().includes(q) ||
          r.region.toLowerCase().includes(q) ||
          (r.raw_text?.toLowerCase().includes(q) ?? false)
      );
    }
    return [...list].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }, [records, search, statusFilter]);

  function handleAction(record: PropertyRecord, status: 'APPROVED' | 'REJECTED') {
    updateRecord.mutate({ id: record.id, data: { Status: status } });
    toast.success(status === 'APPROVED' ? 'تمت الموافقة' : 'تم الرفض');
  }

  function handleDelete(record: PropertyRecord) {
    deleteRecord.mutate(record.id);
    setSelectedRecord(null);
  }

  const STATUS_FILTERS: { label: string; value: StatusFilter }[] = [
    { label: 'الكل', value: 'ALL' },
    { label: 'قيد الانتظار', value: 'PENDING' },
    { label: 'موافق عليه', value: 'APPROVED' },
    { label: 'مرفوض', value: 'REJECTED' },
  ];

  return (
    <Layout>
      <div dir="rtl">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
          <div>
            <h1 style={{ margin: 0, fontSize: 26, fontWeight: 700 }}>السجلات</h1>
            <p style={{ margin: '4px 0 0', fontSize: 14, color: 'var(--color-text-muted)' }}>
              {filtered.length} نتيجة
            </p>
          </div>
          <button
            onClick={() => refetch()}
            disabled={isFetching}
            style={{
              padding: '8px 20px', borderRadius: 'var(--radius-md)',
              border: '1px solid var(--color-border)', background: 'var(--color-surface)',
              color: isFetching ? 'var(--color-text-muted)' : 'var(--color-text)',
              cursor: isFetching ? 'not-allowed' : 'pointer', fontSize: 13, fontWeight: 500,
              display: 'flex', alignItems: 'center', gap: 6, transition: 'all 0.15s ease',
            }}
          >
            <span style={{ display: 'inline-block', animation: isFetching ? 'spin 1s linear infinite' : 'none' }}>↻</span>
            تحديث
          </button>
        </div>

        <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
          <input
            className="input-field"
            placeholder="بحث بالموقع أو المدينة أو النص..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ flex: 1, minWidth: 200 }}
          />
          <div style={{ display: 'flex', gap: 6 }}>
            {STATUS_FILTERS.map((f) => (
              <button
                key={f.value}
                onClick={() => setStatusFilter(f.value)}
                style={{
                  padding: '8px 16px', borderRadius: 100, border: '1px solid',
                  borderColor: statusFilter === f.value ? 'var(--color-accent)' : 'var(--color-border)',
                  background: statusFilter === f.value ? 'rgba(108,99,255,0.15)' : 'transparent',
                  color: statusFilter === f.value ? 'var(--color-accent)' : 'var(--color-text-muted)',
                  fontSize: 12, cursor: 'pointer', whiteSpace: 'nowrap',
                }}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {isLoading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[1,2,3,4,5].map(i => <Skeleton key={i} height={68} />)}
          </div>
        ) : isError ? (
          <div style={{ textAlign: 'center', padding: 60, color: 'var(--color-danger)' }}>
            ⚠️ خطأ في تحميل البيانات
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 60, color: 'var(--color-text-muted)' }}>
            لا توجد نتائج مطابقة
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {filtered.map((record) => (
              <RecordCard
                key={record.id}
                record={record}
                onAction={handleAction}
                onDelete={handleDelete}
                onSelect={setSelectedRecord}
              />
            ))}
          </div>
        )}

        <AnimatePresence>
          {selectedRecord && (
            <RecordModal
              record={selectedRecord}
              onClose={() => setSelectedRecord(null)}
              onAction={handleAction}
              onDelete={handleDelete}
            />
          )}
        </AnimatePresence>
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </Layout>
  );
}

function RecordCard({ record, onAction, onDelete, onSelect }: {
  record: PropertyRecord;
  onAction: (r: PropertyRecord, s: 'APPROVED' | 'REJECTED') => void;
  onDelete: (r: PropertyRecord) => void;
  onSelect: (r: PropertyRecord) => void;
}) {
  const [confirmDelete, setConfirmDelete] = useState(false);

  function handleDeleteClick(e: React.MouseEvent) {
    e.stopPropagation();
    if (confirmDelete) {
      onDelete(record);
    } else {
      setConfirmDelete(true);
      setTimeout(() => setConfirmDelete(false), 3000);
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      style={{
        background: 'var(--color-surface)', border: '1px solid var(--color-border)',
        borderRadius: 'var(--radius-lg)', padding: '16px', cursor: 'pointer',
      }}
      onClick={() => onSelect(record)}
      whileHover={{ borderColor: 'var(--color-accent)' }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
        <div>
          <p style={{ margin: 0, fontWeight: 600, fontSize: 15 }}>{record.location}</p>
          <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--color-text-muted)' }}>{record.city} &bull; {record.region}</p>
        </div>
        <StatusBadge status={record.Status} size="sm" />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', gap: 16 }}>
          <span style={{ fontSize: 13, color: 'var(--color-accent)', fontWeight: 600 }}>
            {formatPrice(record.price, record.currency)}
          </span>
          <span style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>{formatArea(record.area_m2)}</span>
        </div>
        <div style={{ display: 'flex', gap: 6 }} onClick={(e) => e.stopPropagation()}>
          <ActionBtn label="✓" color="var(--color-success)" onClick={() => onAction(record, 'APPROVED')} />
          <ActionBtn label="✕" color="var(--color-danger)" onClick={() => onAction(record, 'REJECTED')} />
          <button
            onClick={handleDeleteClick}
            title={confirmDelete ? 'اضغط مرة أخرى للتأكيد' : 'حذف'}
            style={{
              height: 30, borderRadius: 6, border: '1px solid var(--color-danger)',
              background: confirmDelete ? 'var(--color-danger)' : 'transparent',
              color: confirmDelete ? 'white' : 'var(--color-danger)',
              cursor: 'pointer', fontSize: 11, fontWeight: 700,
              padding: '0 8px', whiteSpace: 'nowrap',
              transition: 'all 0.15s ease',
            }}
          >
            {confirmDelete ? 'تأكيد الحذف' : '🗑'}
          </button>
        </div>
      </div>
    </motion.div>
  );
}

function ActionBtn({ label, color, onClick }: { label: string; color: string; onClick: () => void }) {
  return (
    <button onClick={onClick} style={{
      width: 30, height: 30, borderRadius: 6,
      border: `1px solid ${color}`,
      background: `${color}1a`,
      color, cursor: 'pointer', fontSize: 13, fontWeight: 700,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      transition: 'all 0.15s ease',
    }}>{label}</button>
  );
}

function RecordModal({ record, onClose, onAction, onDelete }: {
  record: PropertyRecord;
  onClose: () => void;
  onAction: (r: PropertyRecord, s: 'APPROVED' | 'REJECTED') => void;
  onDelete: (r: PropertyRecord) => void;
}) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const fields: [string, string][] = [
    ['الموقع', record.location],
    ['المدينة', record.city],
    ['المنطقة', record.region],
    ['السعر', formatPrice(record.price, record.currency)],
    ['المساحة', formatArea(record.area_m2)],
    ['مدة العقد', `${record.contract_duration_years} سنة`],
    ['حالة البناء', record.building_status],
    ['الاكتمال المتوقع', `${record.expected_completion_min_months}–${record.expected_completion_max_months} أشهر`],
    ['تاريخ الإضافة', formatDate(record.createdAt)],
  ];

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 100, background: 'rgba(0,0,0,0.7)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
      }}
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
        onClick={(e) => e.stopPropagation()}
        dir="rtl"
        style={{
          background: 'var(--color-surface)', border: '1px solid var(--color-border)',
          borderRadius: 'var(--radius-xl)', padding: 32,
          width: '100%', maxWidth: 560, maxHeight: '90vh', overflowY: 'auto',
          boxShadow: '0 32px 80px rgba(0,0,0,0.6)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>تفاصيل العقار</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--color-text-muted)', cursor: 'pointer', fontSize: 20 }}>
            &times;
          </button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 }}>
          {fields.map(([label, value]) => (
            <div key={label} style={{
              background: 'var(--color-surface-2)', border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-md)', padding: '12px 14px',
            }}>
              <p style={{ margin: 0, fontSize: 11, color: 'var(--color-text-muted)' }}>{label}</p>
              <p style={{ margin: '4px 0 0', fontSize: 14, fontWeight: 500 }}>{value}</p>
            </div>
          ))}
        </div>

        <div style={{ marginBottom: 20 }}><StatusBadge status={record.Status} /></div>

        {record.raw_text && (
          <div style={{
            padding: 16, background: 'var(--color-surface-2)', border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-md)', fontSize: 13, lineHeight: 1.8,
            whiteSpace: 'pre-wrap', wordBreak: 'break-word', marginBottom: 20,
          }}>
            {record.raw_text}
          </div>
        )}

        <div style={{ display: 'flex', gap: 12, marginBottom: 12 }}>
          <button onClick={() => { onAction(record, 'APPROVED'); onClose(); }} style={{
            flex: 1, padding: 12, borderRadius: 'var(--radius-md)', border: 'none',
            background: 'var(--color-success)', color: 'white', fontWeight: 600, cursor: 'pointer', fontSize: 14,
          }}>✓ موافقة</button>
          <button onClick={() => { onAction(record, 'REJECTED'); onClose(); }} style={{
            flex: 1, padding: 12, borderRadius: 'var(--radius-md)', border: 'none',
            background: 'var(--color-danger)', color: 'white', fontWeight: 600, cursor: 'pointer', fontSize: 14,
          }}>✕ رفض</button>
        </div>
        <button
          onClick={() => {
            if (confirmDelete) {
              onDelete(record);
            } else {
              setConfirmDelete(true);
              setTimeout(() => setConfirmDelete(false), 3000);
            }
          }}
          style={{
            width: '100%', padding: 12, borderRadius: 'var(--radius-md)',
            border: `1px solid var(--color-danger)`,
            background: confirmDelete ? 'var(--color-danger)' : 'transparent',
            color: confirmDelete ? 'white' : 'var(--color-danger)',
            fontWeight: 600, cursor: 'pointer', fontSize: 14,
            transition: 'all 0.15s ease',
          }}
        >
          {confirmDelete ? '⚠️ اضغط مرة أخرى للتأكيد' : '🗑 حذف السجل'}
        </button>
      </motion.div>
    </motion.div>
  );
}
