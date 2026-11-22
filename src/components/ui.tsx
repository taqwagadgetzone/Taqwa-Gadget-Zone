// Shared UI kit — পেজগুলোতে একই রঙ, স্পেসিং ও আচরণ নিশ্চিত করে
import type { ReactNode, ButtonHTMLAttributes } from 'react';

export const BRAND = '#1a3c2e';
export const BRAND_2 = '#2d5a40';

export const BDT = (n: number) =>
  '৳' + (Number.isFinite(n) ? n : 0).toLocaleString('en-IN', { maximumFractionDigits: 2 });

export const USD = (n: number) =>
  '$' + (Number.isFinite(n) ? n : 0).toLocaleString('en-US', { maximumFractionDigits: 2 });

export function cn(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(' ');
}

export const inputCls =
  'w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 ' +
  'focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/20 transition';

export const labelCls = 'mb-1.5 block text-xs font-semibold text-slate-600';

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        'rounded-2xl border border-emerald-100/80 bg-white shadow-[0_1px_2px_rgba(6,78,59,0.05),0_12px_28px_-16px_rgba(6,78,59,0.25)]',
        className
      )}
    >
      {children}
    </div>
  );
}

// প্রতিটি পেজের নিজস্ব সবুজ শেড — একই ডিজাইন সিস্টেম, আলাদা অনুভূতি
export type Theme = 'emerald' | 'forest' | 'lime' | 'sage' | 'jade';
export const THEMES: Record<Theme, string> = {
  emerald: 'linear-gradient(135deg, #064e3b 0%, #047857 55%, #059669 100%)',
  forest:  'linear-gradient(135deg, #14532d 0%, #166534 55%, #15803d 100%)',
  lime:    'linear-gradient(135deg, #365314 0%, #3f6212 55%, #4d7c0f 100%)',
  sage:    'linear-gradient(135deg, #1f3d2b 0%, #2f5d44 55%, #4f7f63 100%)',
  jade:    'linear-gradient(135deg, #022c22 0%, #065f46 55%, #0f766e 100%)',
};

export function PageHeader({
  title, subtitle, actions, theme = 'emerald',
}: { title: string; subtitle?: string; actions?: ReactNode; theme?: Theme }) {
  return (
    <div
      className="relative mb-5 flex flex-col gap-4 overflow-hidden rounded-3xl p-4 text-white shadow-[0_20px_44px_-20px_rgba(6,78,59,0.6)] sm:flex-row sm:items-center sm:justify-between sm:p-6"
      style={{ background: THEMES[theme] }}
    >
      <div className="pointer-events-none absolute -right-14 -top-20 h-56 w-56 rounded-full bg-white/10 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-20 left-1/3 h-48 w-48 rounded-full bg-lime-200/10 blur-3xl" />
      <div className="relative min-w-0">
        <h1 className="truncate text-lg font-bold tracking-tight sm:text-2xl">{title}</h1>
        {subtitle && <p className="mt-1 text-xs text-white/75 sm:text-sm">{subtitle}</p>}
      </div>
      {actions && <div className="relative flex flex-wrap items-center gap-2 sm:gap-3">{actions}</div>}
    </div>
  );
}

type Tone = 'green' | 'red' | 'blue' | 'amber' | 'violet' | 'slate' | 'lime' | 'forest' | 'sage';
const TONE: Record<Tone, { text: string; bg: string; ring: string; bar: string }> = {
  green:  { text: 'text-emerald-700', bg: 'bg-emerald-50', ring: 'ring-emerald-100', bar: 'linear-gradient(90deg,#059669,#6ee7b7)' },
  forest: { text: 'text-green-800',   bg: 'bg-green-50',   ring: 'ring-green-100',   bar: 'linear-gradient(90deg,#15803d,#86efac)' },
  lime:   { text: 'text-lime-800',    bg: 'bg-lime-50',    ring: 'ring-lime-100',    bar: 'linear-gradient(90deg,#4d7c0f,#bef264)' },
  sage:   { text: 'text-[#2f5d44]',   bg: 'bg-emerald-50/70', ring: 'ring-emerald-100', bar: 'linear-gradient(90deg,#2f5d44,#9ac9ac)' },
  red:    { text: 'text-rose-700',    bg: 'bg-rose-50',    ring: 'ring-rose-100',    bar: 'linear-gradient(90deg,#e11d48,#fda4af)' },
  blue:   { text: 'text-blue-700',    bg: 'bg-blue-50',    ring: 'ring-blue-100',    bar: 'linear-gradient(90deg,#2563eb,#93c5fd)' },
  amber:  { text: 'text-amber-700',   bg: 'bg-amber-50',   ring: 'ring-amber-100',   bar: 'linear-gradient(90deg,#d97706,#fcd34d)' },
  violet: { text: 'text-violet-700',  bg: 'bg-violet-50',  ring: 'ring-violet-100',  bar: 'linear-gradient(90deg,#7c3aed,#c4b5fd)' },
  slate:  { text: 'text-slate-700',   bg: 'bg-slate-100',  ring: 'ring-slate-200',   bar: 'linear-gradient(90deg,#64748b,#cbd5e1)' },
};

export function StatCard({
  label, value, sub, tone = 'slate', icon,
}: { label: string; value: string; sub?: string; tone?: Tone; icon?: ReactNode }) {
  const t = TONE[tone];
  return (
    <Card className="relative overflow-hidden p-4">
      <div className="absolute inset-x-0 top-0 h-1" style={{ background: t.bar }} />
      <div className="flex items-start justify-between gap-2">
        <span className="text-xs font-medium text-slate-500">{label}</span>
        {icon && (
          <span className={cn('flex h-8 w-8 items-center justify-center rounded-lg ring-1', t.bg, t.ring)}>{icon}</span>
        )}
      </div>
      <div className={cn('mt-2 truncate text-lg font-bold tabular-nums sm:text-xl', t.text)}>{value}</div>
      {sub && <div className="mt-0.5 truncate text-[11px] text-slate-400">{sub}</div>}
    </Card>
  );
}

export function Badge({ tone = 'slate', children, className }: { tone?: Tone; children: ReactNode; className?: string }) {
  const t = TONE[tone];
  return (
    <span className={cn('inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-medium ring-1', t.bg, t.text, t.ring, className)}>
      {children}
    </span>
  );
}

export function Chip({
  active, onClick, children, tone = 'green',
}: { active?: boolean; onClick?: () => void; children: ReactNode; tone?: Tone }) {
  const activeCls = tone === 'red'
    ? 'bg-rose-600 text-white border-rose-600 shadow-sm'
    : 'bg-gradient-to-r from-emerald-800 to-emerald-600 text-white border-emerald-700 shadow-sm shadow-emerald-900/20';
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'whitespace-nowrap rounded-full border px-3 py-1.5 text-xs font-medium transition active:scale-[0.98]',
        active ? activeCls : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
      )}
    >
      {children}
    </button>
  );
}

export function Button({
  variant = 'primary', className, children, ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'accent' | 'ghost' | 'danger' | 'soft' }) {
  const v = {
    primary: 'bg-gradient-to-r from-emerald-900 to-emerald-700 text-white shadow-md shadow-emerald-900/25 hover:from-emerald-800 hover:to-emerald-600',
    accent:  'bg-gradient-to-r from-emerald-500 to-lime-500 text-white shadow-md shadow-emerald-600/25 hover:from-emerald-600 hover:to-lime-600',
    ghost:   'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50',
    danger:  'bg-rose-600 text-white hover:bg-rose-700',
    soft:    'bg-slate-100 text-slate-700 hover:bg-slate-200',
  }[variant];
  return (
    <button
      {...rest}
      className={cn(
        'inline-flex items-center justify-center gap-1.5 rounded-xl px-4 py-2.5 text-sm font-semibold transition',
        'disabled:cursor-not-allowed disabled:opacity-60 active:scale-[0.98]', v, className
      )}
    >
      {children}
    </button>
  );
}

export function IconButton({
  tone = 'slate', title, onClick, disabled, children,
}: { tone?: 'blue' | 'red' | 'amber' | 'slate'; title: string; onClick: () => void; disabled?: boolean; children: ReactNode }) {
  const c = {
    blue:  'bg-blue-50 text-blue-700 hover:bg-blue-100',
    red:   'bg-rose-50 text-rose-600 hover:bg-rose-100',
    amber: 'bg-amber-50 text-amber-700 hover:bg-amber-100',
    slate: 'bg-slate-100 text-slate-700 hover:bg-slate-200',
  }[tone];
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      onClick={onClick}
      disabled={disabled}
      className={cn('flex h-8 w-8 items-center justify-center rounded-lg text-sm transition disabled:opacity-50', c)}
    >
      {children}
    </button>
  );
}

export function Modal({
  open, title, onClose, children, footer, wide,
}: { open: boolean; title: string; onClose: () => void; children: ReactNode; footer?: ReactNode; wide?: boolean }) {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center bg-slate-900/50 backdrop-blur-[2px] sm:items-center sm:p-4"
      onMouseDown={e => e.target === e.currentTarget && onClose()}
    >
      <div
        className={cn(
          'flex max-h-[92vh] w-full flex-col overflow-hidden bg-white shadow-2xl',
          'rounded-t-3xl sm:rounded-2xl',
          wide ? 'sm:max-w-3xl' : 'sm:max-w-xl'
        )}
      >
        <div
          className="flex items-center justify-between px-5 py-4 text-white"
          style={{ background: `linear-gradient(135deg, ${BRAND}, ${BRAND_2})` }}
        >
          <h2 className="text-base font-bold sm:text-lg">{title}</h2>
          <button type="button" onClick={onClose} aria-label="বন্ধ করুন"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-white/80 hover:bg-white/10 hover:text-white">
            ✕
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-5">{children}</div>
        {footer && <div className="border-t border-slate-100 bg-white px-5 py-3">{footer}</div>}
      </div>
    </div>
  );
}

export function Empty({ icon, text, action }: { icon: string; text: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center py-14 text-center">
      <div className="mb-3 text-4xl">{icon}</div>
      <div className="text-sm font-medium text-slate-500">{text}</div>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function Spinner({ icon, text }: { icon: string; text: string }) {
  return (
    <div className="flex items-center justify-center py-24">
      <div className="text-center">
        <div className="mb-3 animate-bounce text-4xl">{icon}</div>
        <div className="text-sm font-semibold text-emerald-900">{text}</div>
      </div>
    </div>
  );
}
