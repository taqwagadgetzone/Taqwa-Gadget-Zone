// Shared UI kit — পেজগুলোতে একই রঙ, স্পেসিং ও আচরণ নিশ্চিত করে
import type { ReactNode, ButtonHTMLAttributes } from 'react';

export const BRAND = '#0E3B2C';
export const BRAND_2 = '#14513B';

export const BDT = (n: number) =>
  '৳' + (Number.isFinite(n) ? n : 0).toLocaleString('en-IN', { maximumFractionDigits: 2 });

export const USD = (n: number) =>
  '$' + (Number.isFinite(n) ? n : 0).toLocaleString('en-US', { maximumFractionDigits: 2 });

export function cn(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(' ');
}

export const inputCls =
  'w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 ' +
  'focus:border-[#14513B] focus:outline-none focus:ring-2 focus:ring-[#14513B]/20 transition';

export const labelCls = 'mb-1.5 block text-xs font-semibold text-slate-600';

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        'rounded-2xl border border-[#EBCFB2] bg-white shadow-[0_1px_2px_rgba(60,30,10,0.06)]',
        className
      )}
    >
      {children}
    </div>
  );
}

// প্রতিটি পেজের নিজস্ব সবুজ শেড — একই ডিজাইন সিস্টেম, আলাদা অনুভূতি
export type Theme = 'emerald' | 'forest' | 'lime' | 'sage' | 'jade';
// পেজ হেডারের গাঢ় সবুজ — প্রতিটি পেজ আলাদা, তবে একই পরিবারের
export const THEMES: Record<Theme, string> = {
  emerald: '#0E3B2C',
  forest:  '#14513B',
  lime:    '#33561F',
  sage:    '#2F4F3E',
  jade:    '#0B4F4A',
};

export function PageHeader({
  title, subtitle, actions, theme = 'emerald',
}: { title: string; subtitle?: string; actions?: ReactNode; theme?: Theme }) {
  return (
    <div
      className="relative mb-5 flex flex-col gap-4 overflow-hidden rounded-2xl border-b-4 border-[#F26B1D] p-4 text-white shadow-[0_8px_20px_-12px_rgba(14,59,44,0.55)] sm:flex-row sm:items-center sm:justify-between sm:p-6"
      style={{ background: THEMES[theme] }}
    >
      <div className="relative min-w-0">
        <h1 className="font-display truncate text-lg font-bold sm:text-2xl">{title}</h1>
        {subtitle && <p className="mt-1 text-xs text-white/80 sm:text-sm">{subtitle}</p>}
      </div>
      {actions && <div className="relative flex flex-wrap items-center gap-2 sm:gap-3">{actions}</div>}
    </div>
  );
}

type Tone = 'green' | 'red' | 'blue' | 'amber' | 'violet' | 'slate' | 'lime' | 'forest' | 'sage';
const TONE: Record<Tone, { text: string; bg: string; ring: string; bar: string }> = {
  green:  { text: 'text-[#14513B]', bg: 'bg-[#E8F3EE]', ring: 'ring-[#CFE6DA]', bar: '#14513B' },
  forest: { text: 'text-[#14513B]', bg: 'bg-[#E8F3EE]', ring: 'ring-[#CFE6DA]', bar: '#14513B' },
  lime:   { text: 'text-[#33561F]', bg: 'bg-[#EEF5E6]', ring: 'ring-[#D5E6C4]', bar: '#5B8E2E' },
  sage:   { text: 'text-[#2F4F3E]', bg: 'bg-[#EDF3EF]', ring: 'ring-[#CDDDD3]', bar: '#2F4F3E' },
  red:    { text: 'text-rose-700',  bg: 'bg-rose-50',   ring: 'ring-rose-100',  bar: '#E11D48' },
  blue:   { text: 'text-blue-700',  bg: 'bg-blue-50',   ring: 'ring-blue-100',  bar: '#2563EB' },
  amber:  { text: 'text-[#B94A12]', bg: 'bg-orange-50', ring: 'ring-orange-100', bar: '#F26B1D' },
  violet: { text: 'text-violet-700', bg: 'bg-violet-50', ring: 'ring-violet-100', bar: '#7C3AED' },
  slate:  { text: 'text-slate-700', bg: 'bg-slate-100', ring: 'ring-slate-200', bar: '#64748B' },
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
      <div className={cn('font-display mt-2 truncate text-lg font-bold tabular-nums sm:text-xl', t.text)}>{value}</div>
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
    : 'bg-[#14513B] text-white border-[#14513B]';
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
    primary: 'bg-[#14513B] text-white hover:bg-[#0E3B2C]',
    accent:  'bg-[#F26B1D] text-white hover:bg-[#D9560F]',
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
}: { tone?: 'blue' | 'red' | 'amber' | 'slate' | 'green' | 'wa'; title: string; onClick: () => void; disabled?: boolean; children: ReactNode }) {
  const c = {
    wa:    'bg-[#E3F8EC] text-[#128C7E] hover:bg-[#CFF3DF]',
    green: 'bg-[#E8F3EE] text-[#14513B] hover:bg-[#CFE6DA]',
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

// tone="green" — ফর্মের পুরো প্যানেল সবুজ শেডে; বাকি মোডাল সাদা থাকে
export function Modal({
  open, title, onClose, children, footer, wide, tone = 'white',
}: { open: boolean; title: string; onClose: () => void; children: ReactNode; footer?: ReactNode; wide?: boolean; tone?: 'white' | 'green' }) {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center bg-slate-900/50 backdrop-blur-[2px] sm:items-center sm:p-4"
      onMouseDown={e => e.target === e.currentTarget && onClose()}
    >
      <div
        className={cn(
          'flex max-h-[92vh] w-full flex-col overflow-hidden shadow-2xl',
          tone === 'green' ? 'bg-[#E4F2EA]' : 'bg-white',
          'rounded-t-3xl sm:rounded-2xl',
          wide ? 'sm:max-w-3xl' : 'sm:max-w-xl'
        )}
      >
        <div
          className="flex items-center justify-between border-b-[3px] border-[#F26B1D] bg-[#0E3B2C] px-5 py-4 text-white"
        >
          <h2 className="font-display text-base font-bold sm:text-lg">{title}</h2>
          <button type="button" onClick={onClose} aria-label="বন্ধ করুন"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-white/80 hover:bg-white/10 hover:text-white">
            ✕
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-5">{children}</div>
        {footer && (
          <div className={cn('border-t px-5 py-3', tone === 'green' ? 'border-[#B9DCCB] bg-[#D2EADD]' : 'border-slate-100 bg-white')}>
            {footer}
          </div>
        )}
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

// লোডিংয়ে কার্ডের আকারের ধূসর প্লেসহোল্ডার — স্পিনারের চেয়ে তালিকার আকার আগেই বোঝায়
export function SkeletonList({ rows = 4 }: { rows?: number }) {
  return (
    <div className="space-y-3" aria-busy="true" aria-label="লোড হচ্ছে">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="rounded-2xl border border-[#EBCFB2] bg-white p-4 motion-safe:animate-pulse">
          <div className="flex items-center justify-between gap-3">
            <div className="space-y-2">
              <div className="h-3 w-24 rounded bg-slate-200" />
              <div className="h-4 w-44 rounded bg-slate-200" />
            </div>
            <div className="h-6 w-16 rounded-lg bg-slate-200" />
          </div>
          <div className="mt-3 h-3 w-3/4 rounded bg-slate-100" />
        </div>
      ))}
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
