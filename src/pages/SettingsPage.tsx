import { useState } from 'react';
import { toast } from 'sonner';
import Layout from '../components/Layout';
import {
  DEFAULT_SCORING_SETTINGS,
  loadScoringSettings,
  saveScoringSettings,
  type ScoringSettings,
} from '../utils/recordScoring';

const METRICS_ROWS = [
  {
    criterion: 'المسافة من الهدف (كم)',
    scores: ['> 4 كم', '3 – 4 كم', '2 – 3 كم', '1 – 2 كم', '≤ 1 كم'],
  },
  {
    criterion: 'المساحة (م²)',
    scores: ['< 50 م²', '51 – 149 م²', '149.5 – 301 م²', '150 – 300 م²', '200 – 250 م²'],
  },
  {
    criterion: 'ارتفاع المحل (م)',
    scores: ['< 2.5 م', '2.5 – 2.9 م', '3.0 – 3.4 م', '3.5 – 3.9 م', '4.0 م+'],
  },
  {
    criterion: 'السعر مقارنة بمتوسط المنطقة',
    scores: ['أعلى من السوق', 'أقل 0% – 4%', 'أقل 5% – 9%', 'أقل 10% – 14%', 'أقل 15%+'],
  },
  {
    criterion: 'مدة العقد (سنوات)',
    scores: ['< 4 سنوات', '4 – 5', '6 – 7', '8 – 9', '10+'],
  },
  {
    criterion: 'حالة المحل',
    scores: ['مؤجر > 6 أشهر', 'مؤجر < 6 أشهر', 'إنشاء > 6 أشهر', 'إنشاء < 3 أشهر', 'جاهز فوراً'],
  },
];

const SCORE_COLUMNS = [
  { value: 1, label: 'ضعيف', color: '#ef4444', background: 'rgba(239,68,68,0.12)' },
  { value: 2, label: 'منخفض', color: '#f97316', background: 'rgba(249,115,22,0.12)' },
  { value: 3, label: 'متوسط', color: '#eab308', background: 'rgba(234,179,8,0.14)' },
  { value: 4, label: 'جيد', color: '#22c55e', background: 'rgba(34,197,94,0.12)' },
  { value: 5, label: 'ممتاز', color: '#8b5cf6', background: 'rgba(139,92,246,0.14)' },
] as const;

export default function SettingsPage() {
  const [settings, setSettings] = useState<ScoringSettings>(() => loadScoringSettings());

  function updateSettings(next: ScoringSettings) {
    setSettings(next);
    saveScoringSettings(next);
  }

  function handleResetDefaults() {
    updateSettings(DEFAULT_SCORING_SETTINGS);
    toast.success('تمت إعادة الإعدادات الافتراضية');
  }

  return (
    <Layout>
      <div dir="rtl" style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 28, fontWeight: 800 }}>إعدادات التقييم الذكي</h1>
          <p style={{ margin: '8px 0 0', color: 'var(--color-text-muted)', fontSize: 14 }}>
            ضبط معايير التقييم النهائية لكل سجل حسب ملف معايير التقييم.
          </p>
        </div>

        <section style={{
          background: 'var(--color-surface)',
          border: '1px solid var(--color-border)',
          borderRadius: 'var(--radius-xl)',
          padding: 20,
        }}>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>المعايير من ملف التقييم</h2>
          <p style={{ margin: '8px 0 0', fontSize: 13, color: 'var(--color-text-muted)' }}>
            عرض مبسّط للدرجات من 1 إلى 5، مع تمييز لوني لكل مستوى.
          </p>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 14 }}>
            {SCORE_COLUMNS.map((column) => (
              <div
                key={column.value}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '8px 12px',
                  borderRadius: 999,
                  border: `1px solid ${column.color}33`,
                  background: column.background,
                  color: column.color,
                  fontSize: 12,
                  fontWeight: 700,
                }}
              >
                <span>{column.value}</span>
                <span>{column.label}</span>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 14, overflowX: 'auto' }}>
            <table style={{ width: '100%', minWidth: 920, borderCollapse: 'separate', borderSpacing: 0 }}>
              <thead>
                <tr>
                  <th style={thStyleRight}>المعيار</th>
                  {SCORE_COLUMNS.map((column, index) => (
                    <th key={column.value} style={getScoreHeaderStyle(column.color, column.background, index === 0)}>
                      <div style={{ display: 'grid', gap: 2, justifyItems: 'center' }}>
                        <span style={{ fontSize: 15, fontWeight: 800 }}>{column.value}</span>
                        <span>{column.label}</span>
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {METRICS_ROWS.map((row) => (
                  <tr key={row.criterion}>
                    <td style={tdStyleRight}>{row.criterion}</td>
                    {row.scores.map((score, index) => (
                      <td
                        key={`${row.criterion}-${index + 1}`}
                        style={getScoreCellStyle(SCORE_COLUMNS[index].color, SCORE_COLUMNS[index].background)}
                      >
                        {score}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section style={{
          background: 'var(--color-surface)',
          border: '1px solid var(--color-border)',
          borderRadius: 'var(--radius-xl)',
          padding: 20,
          display: 'grid',
          gap: 12,
        }}>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>إعدادات الاحتساب</h2>
          <div style={{ display: 'grid', gap: 10, gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
            <Field
              label="متوسط السوق الافتراضي (SAR)"
              value={settings.fallbackMarketAveragePrice}
              onChange={(value) => updateSettings({ ...settings, fallbackMarketAveragePrice: Number(value) || 0 })}
            />
            <Field
              label="المسافة الافتراضية KM"
              value={settings.fallbackDistanceKm ?? ''}
              onChange={(value) => {
                const parsed = Number.parseFloat(value);
                updateSettings({ ...settings, fallbackDistanceKm: Number.isFinite(parsed) ? parsed : null });
              }}
              placeholder="فارغ = غير معروف"
            />
            <Field
              label="الارتفاع الافتراضي متر"
              value={settings.fallbackStoreHeightM ?? ''}
              onChange={(value) => {
                const parsed = Number.parseFloat(value);
                updateSettings({ ...settings, fallbackStoreHeightM: Number.isFinite(parsed) ? parsed : null });
              }}
              placeholder="فارغ = غير معروف"
            />
            <div>
              <label style={labelStyle}>درجة البيانات المجهولة</label>
              <select
                className="input-field"
                value={settings.unknownCriterionScore}
                onChange={(event) =>
                  updateSettings({ ...settings, unknownCriterionScore: Number(event.target.value) as 1 | 2 | 3 | 4 | 5 })}
              >
                {[1, 2, 3, 4, 5].map((score) => (
                  <option key={score} value={score}>{score}</option>
                ))}
              </select>
            </div>
          </div>
          <button
            onClick={handleResetDefaults}
            style={{
              justifySelf: 'start',
              padding: '10px 14px',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--color-border)',
              background: 'var(--color-surface-2)',
              color: 'var(--color-text-muted)',
              cursor: 'pointer',
              fontSize: 13,
              fontWeight: 600,
            }}
          >
            إعادة الإعدادات الافتراضية
          </button>
        </section>

      </div>
    </Layout>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string | number;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <div>
      <label style={labelStyle}>{label}</label>
      <input
        className="input-field"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
      />
    </div>
  );
}

const labelStyle: React.CSSProperties = {
  display: 'block',
  marginBottom: 6,
  fontSize: 12,
  color: 'var(--color-text-muted)',
};

const thStyleRight: React.CSSProperties = {
  textAlign: 'right',
  padding: '12px 10px',
  borderBottom: '1px solid var(--color-border)',
  borderInlineEnd: '1px solid var(--color-border)',
  background: 'var(--color-surface-2)',
  fontSize: 12,
  whiteSpace: 'nowrap',
};

const tdStyleRight: React.CSSProperties = {
  textAlign: 'right',
  padding: '10px',
  borderBottom: '1px solid var(--color-border)',
  borderInlineEnd: '1px solid var(--color-border)',
  fontSize: 12,
  verticalAlign: 'top',
  fontWeight: 700,
  background: 'rgba(255,255,255,0.02)',
};

function getScoreHeaderStyle(color: string, background: string, isFirstScoreColumn: boolean): React.CSSProperties {
  return {
    textAlign: 'center',
    padding: '12px 10px',
    borderBottom: '1px solid var(--color-border)',
    borderInlineStart: isFirstScoreColumn ? 'none' : '1px solid var(--color-border)',
    background,
    color,
    fontSize: 12,
    whiteSpace: 'nowrap',
  };
}

function getScoreCellStyle(color: string, background: string): React.CSSProperties {
  return {
    textAlign: 'center',
    padding: '12px 10px',
    borderBottom: '1px solid var(--color-border)',
    borderInlineStart: '1px solid var(--color-border)',
    background,
    color: 'var(--color-text)',
    fontSize: 12,
    verticalAlign: 'top',
    fontWeight: 600,
    lineHeight: 1.6,
    boxShadow: `inset 0 3px 0 ${color}`,
  };
}
