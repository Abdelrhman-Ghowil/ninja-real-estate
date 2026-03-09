import { useState, useRef, useEffect, useMemo } from 'react';
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

// ─── Chat types ─────────────────────────────────────────────────────────────

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

// ─── Chat hook ───────────────────────────────────────────────────────────────

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

// ─── Chat Widget ─────────────────────────────────────────────────────────────

function ChatWidget() {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [hasUnread, setHasUnread] = useState(true);
  const { msgs, loading, send, showQuick } = useChatSession();
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setHasUnread(false);
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 80);
      setTimeout(() => inputRef.current?.focus(), 120);
    }
  }, [open]);

  useEffect(() => {
    if (open) {
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 60);
    }
  }, [msgs, loading]);

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

        {/* ── Chat Panel ── */}
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
              {/* Header */}
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

              {/* Messages */}
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

                {/* Typing indicator */}
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

                {/* Quick replies */}
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

              {/* Input */}
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

        {/* ── Trigger button ── */}
        <div style={{ position: 'relative' }}>
          {/* Pulse ring */}
          {!open && (
            <div style={{
              position: 'absolute', inset: 0, borderRadius: '50%',
              background: 'var(--color-accent)',
              animation: 'pulse-ring 2s ease-out infinite',
            }} />
          )}

          <motion.button
            onClick={() => setOpen(v => !v)}
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

            {/* Unread badge */}
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

      {/* ── Floating Chat Widget ── */}
      <ChatWidget />

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
