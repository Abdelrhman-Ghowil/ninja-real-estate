import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import Layout from '../components/Layout';
import {
  DEFAULT_SCORING_SETTINGS,
  loadScoringSettings,
  saveScoringSettings,
  type ScoringSettings,
  normalizeDistrictKey,
} from '../utils/recordScoring';

const METRICS_ROWS = [
  {
    criterion: 'Distance from Target (km)',
    score1: '> 4 KM',
    score2: '> 3 KM to 4 KM',
    score3: '> 2 KM to 3 KM',
    score4: '> 1 KM to 2 KM',
    score5: '<= 1 KM',
  },
  {
    criterion: 'Size (sqm)',
    score1: '< 50 sqm or Unsuitable',
    score2: '51 – 149 sqm',
    score3: '149.5 – 301 sqm',
    score4: '150 – 300 sqm',
    score5: '200 – 250 sqm',
  },
  {
    criterion: 'Store Height (m)',
    score1: '< 2.5 meters or Unsuitable',
    score2: '2.5 – 2.9 meters',
    score3: '3.0 – 3.4 meters',
    score4: '3.5 – 3.9 meters',
    score5: '4.0 meters',
  },
  {
    criterion: 'Price (vs. District Market Avg.)',
    score1: 'Above Market Avg.',
    score2: '0 – 4% Below Market Avg.',
    score3: '5 – 9% Below Market Avg.',
    score4: '10 – 14% Below Market Avg.',
    score5: '15%+ Below Market Avg.',
  },
  {
    criterion: 'Contract Duration (years)',
    score1: '< 4 years',
    score2: '4 – 5 years',
    score3: '6 – 7 years',
    score4: '8 – 9 years',
    score5: '>= 10 years',
  },
  {
    criterion: 'Store Status',
    score1: 'Occupied (long-term) > 6 months',
    score2: 'Occupied (lease ending < 6 months)',
    score3: 'Under Construction (long timeline > 6 months)',
    score4: 'Under Construction (short timeline < 3 months)',
    score5: 'Ready for Rent (immediate)',
  },
];

export default function SettingsPage() {
  const [settings, setSettings] = useState<ScoringSettings>(() => loadScoringSettings());
  const [city, setCity] = useState('');
  const [region, setRegion] = useState('');
  const [average, setAverage] = useState('');

  const districtEntries = useMemo(() => {
    return Object.entries(settings.districtMarketAverages).sort((a, b) => a[0].localeCompare(b[0]));
  }, [settings.districtMarketAverages]);

  function updateSettings(next: ScoringSettings) {
    setSettings(next);
    saveScoringSettings(next);
  }

  function handleAddDistrictAverage() {
    const normalizedCity = city.trim();
    const normalizedRegion = region.trim();
    const parsedAverage = Number.parseFloat(average);
    if (!normalizedCity || !normalizedRegion || !Number.isFinite(parsedAverage) || parsedAverage <= 0) {
      toast.error('أدخل المدينة والمنطقة ومتوسط سعر صحيح');
      return;
    }
    const key = normalizeDistrictKey(normalizedCity, normalizedRegion);
    updateSettings({
      ...settings,
      districtMarketAverages: {
        ...settings.districtMarketAverages,
        [key]: parsedAverage,
      },
    });
    setCity('');
    setRegion('');
    setAverage('');
    toast.success('تم حفظ متوسط سعر المنطقة');
  }

  function handleRemoveDistrictAverage(key: string) {
    const next = { ...settings.districtMarketAverages };
    delete next[key];
    updateSettings({
      ...settings,
      districtMarketAverages: next,
    });
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
            ضبط معايير التقييم النهائية لكل سجل حسب Evaluation Metrices.
          </p>
        </div>

        <section style={{
          background: 'var(--color-surface)',
          border: '1px solid var(--color-border)',
          borderRadius: 'var(--radius-xl)',
          padding: 20,
        }}>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>المعايير من ملف التقييم</h2>
          <div style={{ marginTop: 14, overflowX: 'auto' }}>
            <table style={{ width: '100%', minWidth: 920, borderCollapse: 'separate', borderSpacing: 0 }}>
              <thead>
                <tr>
                  <th style={thStyleRight}>المعيار</th>
                  <th style={thStyleCenter}>1</th>
                  <th style={thStyleCenter}>2</th>
                  <th style={thStyleCenter}>3</th>
                  <th style={thStyleCenter}>4</th>
                  <th style={thStyleCenter}>5</th>
                </tr>
              </thead>
              <tbody>
                {METRICS_ROWS.map((row) => (
                  <tr key={row.criterion}>
                    <td style={tdStyleRight}>{row.criterion}</td>
                    <td style={tdStyleCenter}>{row.score1}</td>
                    <td style={tdStyleCenter}>{row.score2}</td>
                    <td style={tdStyleCenter}>{row.score3}</td>
                    <td style={tdStyleCenter}>{row.score4}</td>
                    <td style={tdStyleCenter}>{row.score5}</td>
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

        <section style={{
          background: 'var(--color-surface)',
          border: '1px solid var(--color-border)',
          borderRadius: 'var(--radius-xl)',
          padding: 20,
          display: 'grid',
          gap: 14,
        }}>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>متوسطات الأسعار حسب المنطقة</h2>
          <div style={{ display: 'grid', gap: 10, gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
            <Field label="المدينة" value={city} onChange={setCity} placeholder="النعيرية" />
            <Field label="المنطقة" value={region} onChange={setRegion} placeholder="المنطقة الشرقية" />
            <Field label="متوسط السعر (SAR)" value={average} onChange={setAverage} placeholder="400000" />
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button
              onClick={handleAddDistrictAverage}
              style={{
                padding: '10px 16px',
                borderRadius: 'var(--radius-md)',
                border: 'none',
                background: 'var(--color-accent)',
                color: 'white',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              إضافة متوسط
            </button>
          </div>

          {districtEntries.length === 0 ? (
            <div style={{
              border: '1px dashed var(--color-border)',
              borderRadius: 'var(--radius-md)',
              padding: 14,
              color: 'var(--color-text-muted)',
              fontSize: 13,
            }}>
              لا توجد مناطق مضافة حالياً.
            </div>
          ) : (
            <div style={{ display: 'grid', gap: 8 }}>
              {districtEntries.map(([key, value]) => (
                <div
                  key={key}
                  style={{
                    border: '1px solid var(--color-border)',
                    borderRadius: 'var(--radius-md)',
                    padding: '10px 12px',
                    background: 'var(--color-surface-2)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 10,
                  }}
                >
                  <span style={{ fontSize: 13 }}>
                    {key.replace('::', ' • ')} — {Math.round(value).toLocaleString('en-US')} SAR
                  </span>
                  <button
                    onClick={() => handleRemoveDistrictAverage(key)}
                    style={{
                      border: '1px solid var(--color-danger)',
                      color: 'var(--color-danger)',
                      background: 'transparent',
                      borderRadius: 8,
                      padding: '4px 10px',
                      cursor: 'pointer',
                      fontSize: 12,
                    }}
                  >
                    حذف
                  </button>
                </div>
              ))}
            </div>
          )}
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
  background: 'var(--color-surface-2)',
  fontSize: 12,
  whiteSpace: 'nowrap',
};

const thStyleCenter: React.CSSProperties = {
  textAlign: 'center',
  padding: '12px 10px',
  borderBottom: '1px solid var(--color-border)',
  background: 'var(--color-surface-2)',
  fontSize: 12,
  whiteSpace: 'nowrap',
};

const tdStyleRight: React.CSSProperties = {
  textAlign: 'right',
  padding: '10px',
  borderBottom: '1px solid var(--color-border)',
  fontSize: 12,
  verticalAlign: 'top',
};

const tdStyleCenter: React.CSSProperties = {
  textAlign: 'center',
  padding: '10px',
  borderBottom: '1px solid var(--color-border)',
  fontSize: 12,
  verticalAlign: 'top',
};
