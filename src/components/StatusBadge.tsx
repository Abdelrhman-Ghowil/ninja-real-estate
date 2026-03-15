import type { RecordStatus } from '../api/records';

const STATUS_CONFIG = {
  APPROVED: {
    label: 'موافق عليه',
    color: 'var(--color-success)',
    bg: 'rgba(34,197,94,0.1)',
    border: 'rgba(34,197,94,0.3)',
  },
  REJECTED: {
    label: 'مرفوض',
    color: 'var(--color-danger)',
    bg: 'rgba(239,68,68,0.1)',
    border: 'rgba(239,68,68,0.3)',
  },
  null: {
    label: 'قيد الانتظار',
    color: 'var(--color-warning)',
    bg: 'rgba(245,158,11,0.1)',
    border: 'rgba(245,158,11,0.3)',
  },
};

interface Props {
  status: RecordStatus;
  size?: 'sm' | 'md';
}

export default function StatusBadge({ status, size = 'md' }: Props) {
  const key = status === 'APPROVED' || status === 'REJECTED' ? status : 'null';
  const cfg = STATUS_CONFIG[key];
  const padding = size === 'sm' ? '2px 8px' : '4px 12px';
  const fontSize = size === 'sm' ? 11 : 12;

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        padding,
        borderRadius: 100,
        fontSize,
        fontWeight: 600,
        color: cfg.color,
        background: cfg.bg,
        border: `1px solid ${cfg.border}`,
        whiteSpace: 'nowrap',
      }}
    >
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: cfg.color, display: 'inline-block' }} />
      {cfg.label}
    </span>
  );
}
