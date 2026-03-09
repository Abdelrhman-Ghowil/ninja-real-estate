import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { motion, AnimatePresence } from 'framer-motion';
import { useCreateRecord } from '../hooks/useRecords';

const schema = z.object({
  location: z.string().min(1, 'الموقع مطلوب'),
  city: z.string().min(1, 'المدينة مطلوبة'),
  region: z.string().min(1, 'المنطقة مطلوبة'),
  area_m2: z.string().min(1, 'المساحة مطلوبة'),
  price: z.string().min(1, 'السعر مطلوب'),
  contract_duration_years: z.string(),
  building_status: z.string(),
  expected_completion_min_months: z.string(),
  expected_completion_max_months: z.string(),
  raw_text: z.string(),
  honeypot: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

const FIELDS: Array<{
  name: keyof Omit<FormData, 'honeypot'>;
  label: string;
  placeholder?: string;
  required?: boolean;
  multiline?: boolean;
}> = [
  { name: 'location', label: 'الموقع الكامل', placeholder: 'مثال: النعيرية – المنطقة الشرقية', required: true },
  { name: 'city', label: 'المدينة', placeholder: 'مثال: النعيرية', required: true },
  { name: 'region', label: 'المنطقة', placeholder: 'مثال: المنطقة الشرقية', required: true },
  { name: 'area_m2', label: 'المساحة (م²)', placeholder: '1080', required: true },
  { name: 'price', label: 'السعر (ريال)', placeholder: '400000', required: true },
  { name: 'contract_duration_years', label: 'مدة العقد (سنوات)', placeholder: '10' },
  { name: 'building_status', label: 'حالة البناء', placeholder: 'تحت التشطيب' },
  { name: 'expected_completion_min_months', label: 'الاكتمال المتوقع (أدنى - أشهر)', placeholder: '3' },
  { name: 'expected_completion_max_months', label: 'الاكتمال المتوقع (أقصى - أشهر)', placeholder: '6' },
  { name: 'raw_text', label: 'النص الأصلي (اختياري)', placeholder: 'الصق النص الأصلي هنا...', multiline: true },
];

export default function SubmitPage() {
  const [submitted, setSubmitted] = useState(false);
  const [isRateLimited, setIsRateLimited] = useState(false);
  const createRecord = useCreateRecord();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      contract_duration_years: '',
      building_status: '',
      expected_completion_min_months: '',
      expected_completion_max_months: '',
      raw_text: '',
      honeypot: '',
    },
  });

  async function onSubmit(data: FormData) {
    if (isRateLimited) return;
    if (data.honeypot) return;
    const payload = { ...data };
    delete payload.honeypot;
    await createRecord.mutateAsync({ ...payload, currency: 'SAR', Status: null });
    setIsRateLimited(true);
    window.setTimeout(() => setIsRateLimited(false), 10_000);
    setSubmitted(true);
  }

  function handleSubmitAnother() {
    setSubmitted(false);
    reset();
  }

  return (
    <div dir="rtl" style={{ minHeight: '100vh', background: 'var(--color-bg)', padding: '40px 24px' }}>
      <div style={{ maxWidth: 600, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
            <div style={{
              width: 40, height: 40, borderRadius: 10,
              background: 'linear-gradient(135deg, var(--color-accent), #a78bfa)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 18, fontWeight: 700, color: 'white',
            }}>N</div>
            <span style={{ fontSize: 20, fontWeight: 700 }}>Ninja Real Estate</span>
          </div>
          <h1 style={{ margin: 0, fontSize: 28, fontWeight: 700 }}>إرسال عقار جديد</h1>
          <p style={{ margin: '8px 0 0', color: 'var(--color-text-muted)' }}>
            أرسل تفاصيل العقار وسيتم مراجعته من قِبَل فريقنا
          </p>
        </div>

        <AnimatePresence mode="wait">
          {submitted ? (
            <motion.div
              key="success"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              style={{
                background: 'var(--color-surface)', border: '1px solid rgba(34,197,94,0.3)',
                borderRadius: 'var(--radius-xl)', padding: 48, textAlign: 'center',
              }}
            >
              <div style={{ fontSize: 64, marginBottom: 20 }}>🎉</div>
              <h2 style={{ margin: '0 0 8px', fontSize: 22 }}>تم الإرسال بنجاح!</h2>
              <p style={{ margin: '0 0 32px', color: 'var(--color-text-muted)' }}>
                شكراً لك! سيتم مراجعة طلبك قريباً.
              </p>
              <button
                onClick={handleSubmitAnother}
                style={{
                  padding: '12px 32px', borderRadius: 'var(--radius-md)', border: 'none',
                  background: 'var(--color-accent)', color: 'white', fontSize: 15, fontWeight: 600, cursor: 'pointer',
                }}
              >
                إرسال عقار آخر
              </button>
            </motion.div>
          ) : (
            <motion.div
              key="form"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -16 }}
              style={{
                background: 'var(--color-surface)', border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-xl)', padding: 32,
                boxShadow: '0 16px 48px rgba(0,0,0,0.3)',
              }}
            >
              <form onSubmit={handleSubmit(onSubmit)} noValidate>
                <input {...register('honeypot')} style={{ display: 'none' }} tabIndex={-1} aria-hidden="true" />
                <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                  {FIELDS.map(({ name, label, placeholder, required, multiline }) => (
                    <div key={name}>
                      <label style={{
                        display: 'block', marginBottom: 6, fontSize: 13, fontWeight: 500,
                        color: 'var(--color-text-muted)',
                      }}>
                        {label} {required && <span style={{ color: 'var(--color-danger)' }}>*</span>}
                      </label>
                      {multiline ? (
                        <textarea
                          {...register(name)}
                          className="input-field"
                          placeholder={placeholder}
                          rows={4}
                          style={{ resize: 'vertical', fontFamily: 'inherit' }}
                        />
                      ) : (
                        <input {...register(name)} className="input-field" placeholder={placeholder} />
                      )}
                      {errors[name] && (
                        <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--color-danger)' }}>
                          {errors[name]?.message as string}
                        </p>
                      )}
                    </div>
                  ))}

                  <p style={{ margin: 0, fontSize: 12, color: 'var(--color-text-muted)', textAlign: 'center' }}>
                    يُسمح بإرسال واحد كل 10 ثوانٍ
                  </p>

                  <motion.button
                    type="submit"
                    disabled={isSubmitting || createRecord.isPending || isRateLimited}
                    whileHover={{ scale: 1.01 }}
                    whileTap={{ scale: 0.98 }}
                    style={{
                      padding: '14px', borderRadius: 'var(--radius-md)', border: 'none',
                      background: (isSubmitting || createRecord.isPending || isRateLimited) ? 'var(--color-surface-2)' : 'var(--color-accent)',
                      color: 'white', fontSize: 15, fontWeight: 600,
                      cursor: (isSubmitting || createRecord.isPending || isRateLimited) ? 'not-allowed' : 'pointer',
                      transition: 'background 0.2s',
                    }}
                  >
                    {(isSubmitting || createRecord.isPending) ? 'جارِ الإرسال...' : isRateLimited ? 'انتظر 10 ثوانٍ' : 'إرسال العقار'}
                  </motion.button>
                </div>
              </form>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
