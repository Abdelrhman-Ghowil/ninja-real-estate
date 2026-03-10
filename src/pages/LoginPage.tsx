import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { login, isAuthenticated } from '../utils/auth';
import { useCreateRecord } from '../hooks/useRecords';

// ─── Schemas ────────────────────────────────────────────────────────────────

const schema = z.object({
  username: z.string().min(1, 'مطلوب'),
  password: z.string().min(1, 'مطلوب'),
});
type FormData = z.infer<typeof schema>;

const submitSchema = z.object({
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
type SubmitData = z.infer<typeof submitSchema>;

// ─── Shared UI helpers ───────────────────────────────────────────────────────

function SectionLabel({ icon, label }: { icon: string; label: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 10 }}>
      <span style={{ fontSize: 13 }}>{icon}</span>
      <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-accent)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
        {label}
      </span>
      <div style={{ flex: 1, height: 1, background: 'var(--color-border)' }} />
    </div>
  );
}

function Field({
  label, placeholder, required, multiline, error, inputProps,
}: {
  label: string; placeholder?: string; required?: boolean;
  multiline?: boolean; error?: string;
  inputProps: React.InputHTMLAttributes<HTMLInputElement> & React.TextareaHTMLAttributes<HTMLTextAreaElement>;
}) {
  return (
    <div>
      <label style={{ display: 'block', marginBottom: 5, fontSize: 12, fontWeight: 500, color: 'var(--color-text-muted)' }}>
        {label} {required && <span style={{ color: 'var(--color-danger)' }}>*</span>}
      </label>
      {multiline ? (
        <textarea {...inputProps} className="input-field" placeholder={placeholder} rows={3}
          style={{ resize: 'vertical', fontFamily: 'inherit' }} />
      ) : (
        <input {...inputProps} className="input-field" placeholder={placeholder} />
      )}
      {error && <p style={{ margin: '4px 0 0', fontSize: 11, color: 'var(--color-danger)' }}>{error}</p>}
    </div>
  );
}

// ─── Login Page ──────────────────────────────────────────────────────────────

export default function LoginPage() {
  const navigate = useNavigate();
  const [showModal, setShowModal] = useState(false);
  const [submitDone, setSubmitDone] = useState(false);
  const lastSubmit = useRef<number>(0);
  const createRecord = useCreateRecord();

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  const {
    register: regS,
    handleSubmit: handleS,
    reset: resetS,
    formState: { errors: errS, isSubmitting: pendingS },
  } = useForm<SubmitData>({
    resolver: zodResolver(submitSchema),
    defaultValues: {
      contract_duration_years: '',
      building_status: '',
      expected_completion_min_months: '',
      expected_completion_max_months: '',
      raw_text: '',
      honeypot: '',
    },
  });

  useEffect(() => {
    if (isAuthenticated()) navigate('/review');
  }, [navigate]);

  useEffect(() => {
    document.body.style.overflow = showModal ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [showModal]);

  function closeModal() {
    setShowModal(false);
    setSubmitDone(false);
    resetS();
  }

  async function onSubmit(data: FormData) {
    await new Promise(r => setTimeout(r, 400));
    const ok = login(data.username, data.password);
    if (ok) {
      toast.success('مرحباً بك!');
      navigate('/review');
    } else {
      toast.error('اسم المستخدم أو كلمة المرور غير صحيحة');
    }
  }

  async function onSubmitProperty(data: SubmitData) {
    const now = Date.now();
    if (now - lastSubmit.current < 10_000) return;
    if (data.honeypot) return;
    await createRecord.mutateAsync({
      location: data.location,
      city: data.city,
      region: data.region,
      area_m2: data.area_m2,
      price: data.price,
      contract_duration_years: data.contract_duration_years,
      building_status: data.building_status,
      expected_completion_min_months: data.expected_completion_min_months,
      expected_completion_max_months: data.expected_completion_max_months,
      raw_text: data.raw_text,
      currency: 'SAR',
      Status: null,
    });
    lastSubmit.current = now;
    setSubmitDone(true);
  }

  return (
    <div
      dir="rtl"
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--color-bg)',
        padding: 24,
      }}
    >
      {/* Background glow */}
      <div style={{ position: 'fixed', inset: 0, overflow: 'hidden', pointerEvents: 'none' }}>
        <div style={{
          position: 'absolute', top: '20%', left: '50%', transform: 'translateX(-50%)',
          width: 600, height: 600, borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(108,99,255,0.08) 0%, transparent 70%)',
        }} />
      </div>

      {/* Login card */}
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        style={{
          width: '100%',
          maxWidth: 400,
          background: 'var(--color-surface)',
          border: '1px solid var(--color-border)',
          borderRadius: 'var(--radius-xl)',
          padding: 40,
          boxShadow: '0 24px 80px rgba(0,0,0,0.4)',
        }}
      >
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{
            width: 56, height: 56, borderRadius: 16,
            background: 'linear-gradient(135deg, var(--color-accent), #a78bfa)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 24, fontWeight: 700, color: 'white',
            margin: '0 auto 16px',
            boxShadow: '0 8px 24px rgba(108,99,255,0.3)',
          }}>N</div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: 'var(--color-text)' }}>
            Ninja Real Estate
          </h1>
          <p style={{ margin: '8px 0 0', fontSize: 14, color: 'var(--color-text-muted)' }}>
            تسجيل الدخول للمتابعة
          </p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <label style={{ display: 'block', marginBottom: 6, fontSize: 13, fontWeight: 500, color: 'var(--color-text-muted)' }}>
              اسم المستخدم
            </label>
            <input
              {...register('username')}
              className="input-field"
              placeholder="admin"
              autoComplete="username"
            />
            {errors.username && (
              <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--color-danger)' }}>
                {errors.username.message}
              </p>
            )}
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: 6, fontSize: 13, fontWeight: 500, color: 'var(--color-text-muted)' }}>
              كلمة المرور
            </label>
            <input
              {...register('password')}
              type="password"
              className="input-field"
              placeholder="••••••••"
              autoComplete="current-password"
            />
            {errors.password && (
              <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--color-danger)' }}>
                {errors.password.message}
              </p>
            )}
          </div>

          <motion.button
            type="submit"
            disabled={isSubmitting}
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.98 }}
            style={{
              marginTop: 8,
              padding: '14px',
              borderRadius: 'var(--radius-md)',
              background: isSubmitting ? 'var(--color-surface-2)' : 'var(--color-accent)',
              color: 'white',
              border: 'none',
              fontSize: 15,
              fontWeight: 600,
              cursor: isSubmitting ? 'not-allowed' : 'pointer',
              transition: 'background 0.2s',
              fontFamily: 'inherit',
            }}
          >
            {isSubmitting ? 'جارٍ الدخول...' : 'دخول'}
          </motion.button>
        </form>

        <p style={{ margin: '24px 0 0', textAlign: 'center', fontSize: 12, color: 'var(--color-text-muted)' }}>
          المستخدم التجريبي: admin / ninja2026
        </p>

        {/* Divider + submit property button */}
        <div style={{ marginTop: 16 }}>
          <div style={{ borderTop: '1px solid var(--color-border)', marginBottom: 16 }} />
          <button
            onClick={() => setShowModal(true)}
            style={{
              width: '100%',
              padding: '9px 0',
              background: 'none',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-md)',
              color: 'var(--color-text-muted)',
              fontSize: 13,
              cursor: 'pointer',
              fontFamily: 'inherit',
              transition: 'border-color 0.2s, color 0.2s',
            }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--color-accent)';
              (e.currentTarget as HTMLButtonElement).style.color = 'var(--color-accent)';
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--color-border)';
              (e.currentTarget as HTMLButtonElement).style.color = 'var(--color-text-muted)';
            }}
          >
            🏠 إرسال عقار جديد
          </button>
        </div>
      </motion.div>

      {/* ── Submit property modal ── */}
      <AnimatePresence>
        {showModal && (
          <>
            <motion.div
              key="backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={closeModal}
              style={{
                position: 'fixed', inset: 0, zIndex: 50,
                background: 'rgba(0,0,0,0.7)',
                backdropFilter: 'blur(4px)',
              }}
            />

            <div style={{
              position: 'fixed', inset: 0, zIndex: 51,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              padding: 16, pointerEvents: 'none',
            }}>
              <motion.div
                key="modal"
                initial={{ opacity: 0, y: 32, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 16, scale: 0.96 }}
                transition={{ type: 'spring', stiffness: 340, damping: 28 }}
                onClick={(e: React.MouseEvent) => e.stopPropagation()}
                style={{
                  pointerEvents: 'auto',
                  width: '100%', maxWidth: 540,
                  maxHeight: '88vh', overflowY: 'auto',
                  background: 'var(--color-surface)',
                  border: '1px solid var(--color-border)',
                  borderRadius: 'var(--radius-xl)',
                  boxShadow: '0 32px 80px rgba(0,0,0,0.6)',
                }}
              >
                {/* Modal header */}
                <div style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '20px 24px 0',
                  position: 'sticky', top: 0,
                  background: 'var(--color-surface)',
                  zIndex: 1,
                  paddingBottom: 16,
                  borderBottom: '1px solid var(--color-border)',
                }}>
                  <div>
                    <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700 }}>🏠 إرسال عقار جديد</h2>
                    <p style={{ margin: '3px 0 0', fontSize: 12, color: 'var(--color-text-muted)' }}>
                      أرسل التفاصيل وسيراجعه فريقنا قريباً
                    </p>
                  </div>
                  <button
                    onClick={closeModal}
                    style={{
                      width: 32, height: 32, borderRadius: 8,
                      background: 'var(--color-surface-2)',
                      border: '1px solid var(--color-border)',
                      color: 'var(--color-text-muted)',
                      fontSize: 14, cursor: 'pointer',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontFamily: 'inherit', flexShrink: 0,
                    }}
                    aria-label="إغلاق"
                  >✕</button>
                </div>

                {/* Modal body */}
                <div style={{ padding: '20px 24px 24px' }}>
                  <AnimatePresence mode="wait">
                    {submitDone ? (
                      <motion.div
                        key="success"
                        initial={{ opacity: 0, scale: 0.92 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0 }}
                        style={{ textAlign: 'center', padding: '32px 0' }}
                      >
                        <div style={{ fontSize: 56, marginBottom: 14 }}>🎉</div>
                        <h3 style={{ margin: '0 0 8px', fontSize: 19 }}>تم الإرسال بنجاح!</h3>
                        <p style={{ margin: '0 0 24px', color: 'var(--color-text-muted)', fontSize: 14 }}>
                          شكراً! سيراجع فريقنا طلبك ويتواصل معك قريباً.
                        </p>
                        <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
                          <button
                            onClick={() => { setSubmitDone(false); resetS(); }}
                            style={{
                              padding: '9px 22px', borderRadius: 'var(--radius-md)', border: 'none',
                              background: 'var(--color-accent)', color: 'white',
                              fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
                            }}
                          >إرسال عقار آخر</button>
                          <button
                            onClick={closeModal}
                            style={{
                              padding: '9px 22px', borderRadius: 'var(--radius-md)',
                              border: '1px solid var(--color-border)',
                              background: 'transparent', color: 'var(--color-text-muted)',
                              fontSize: 13, cursor: 'pointer', fontFamily: 'inherit',
                            }}
                          >إغلاق</button>
                        </div>
                      </motion.div>
                    ) : (
                      <motion.form
                        key="form"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onSubmit={handleS(onSubmitProperty)}
                        noValidate
                      >
                        <input {...regS('honeypot')} style={{ display: 'none' }} tabIndex={-1} aria-hidden="true" />
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                          <div>
                            <SectionLabel icon="📍" label="الموقع" />
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                              <Field label="الموقع الكامل" placeholder="مثال: النعيرية – المنطقة الشرقية" required
                                error={errS.location?.message} inputProps={regS('location')} />
                              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                                <Field label="المدينة" placeholder="النعيرية" required
                                  error={errS.city?.message} inputProps={regS('city')} />
                                <Field label="المنطقة" placeholder="المنطقة الشرقية" required
                                  error={errS.region?.message} inputProps={regS('region')} />
                              </div>
                            </div>
                          </div>

                          <div>
                            <SectionLabel icon="💰" label="السعر والمساحة" />
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                              <Field label="المساحة (م²)" placeholder="1080" required
                                error={errS.area_m2?.message} inputProps={regS('area_m2')} />
                              <Field label="السعر (ريال)" placeholder="400000" required
                                error={errS.price?.message} inputProps={regS('price')} />
                            </div>
                          </div>

                          <div>
                            <SectionLabel icon="📋" label="العقد والبناء" />
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                              <Field label="مدة العقد (سنوات)" placeholder="10"
                                error={errS.contract_duration_years?.message} inputProps={regS('contract_duration_years')} />
                              <Field label="حالة البناء" placeholder="تحت التشطيب"
                                error={errS.building_status?.message} inputProps={regS('building_status')} />
                            </div>
                          </div>

                          <div>
                            <SectionLabel icon="🗓️" label="موعد الاكتمال المتوقع" />
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                              <Field label="أدنى (أشهر)" placeholder="3"
                                error={errS.expected_completion_min_months?.message}
                                inputProps={regS('expected_completion_min_months')} />
                              <Field label="أقصى (أشهر)" placeholder="6"
                                error={errS.expected_completion_max_months?.message}
                                inputProps={regS('expected_completion_max_months')} />
                            </div>
                          </div>

                          <div>
                            <SectionLabel icon="📝" label="النص الأصلي" />
                            <Field label="الصق الإعلان الأصلي هنا (اختياري)" placeholder="الصق النص الأصلي هنا..."
                              multiline error={errS.raw_text?.message} inputProps={regS('raw_text')} />
                          </div>

                          <motion.button
                            type="submit"
                            disabled={pendingS || createRecord.isPending}
                            whileHover={{ scale: 1.01 }}
                            whileTap={{ scale: 0.98 }}
                            style={{
                              padding: '13px', borderRadius: 'var(--radius-md)', border: 'none',
                              background: (pendingS || createRecord.isPending)
                                ? 'var(--color-surface-2)' : 'var(--color-accent)',
                              color: 'white', fontSize: 15, fontWeight: 600,
                              cursor: (pendingS || createRecord.isPending) ? 'not-allowed' : 'pointer',
                              transition: 'background 0.2s', fontFamily: 'inherit',
                            }}
                          >
                            {(pendingS || createRecord.isPending) ? 'جارِ الإرسال...' : 'إرسال العقار'}
                          </motion.button>
                        </div>
                      </motion.form>
                    )}
                  </AnimatePresence>
                </div>
              </motion.div>
            </div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
