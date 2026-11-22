import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useBusinessData } from '../hooks/useBusinessData';
import {
  summarize, byChannel, dailySeries, datesOf, inRange, stockSummary, courierStatusCounts,
  isLost, isCourier, type Range, type Channel, CHANNELS,
} from '../services/accounting';
import {
  BDT, cn, Card, PageHeader, StatCard, Badge, Chip, Spinner, Empty,
} from '../components/ui';
import type { Sale } from '../types';

const todayStr = () => new Date().toISOString().split('T')[0];
const monthNow = () => todayStr().slice(0, 7);
const monthLabel = (m: string) => new Date(m + '-01').toLocaleString('bn-BD', { month: 'long', year: 'numeric' });

const STATUS_LABEL: Record<string, { label: string; tone: 'green' | 'amber' | 'blue' | 'red' | 'violet' | 'slate' }> = {
  pending:                    { label: 'পেন্ডিং', tone: 'amber' },
  in_review:                  { label: 'রিভিউতে', tone: 'blue' },
  delivered_approval_pending: { label: 'ডেলিভারি অপেক্ষায়', tone: 'amber' },
  partial_delivered:          { label: 'আংশিক', tone: 'violet' },
  delivered:                  { label: 'ডেলিভারি', tone: 'green' },
  cancelled:                  { label: 'বাতিল', tone: 'red' },
  returned_to_merchant:       { label: 'ফেরত এসেছে', tone: 'red' },
  returned_to_courier:        { label: 'কুরিয়ারে ফেরত', tone: 'red' },
  partial_returned_to_merchant: { label: 'আংশিক ফেরত', tone: 'red' },
  hold:                       { label: 'হোল্ড', tone: 'slate' },
};

const CHANNEL_STYLE: Record<Channel, { tone: 'blue' | 'violet' | 'slate'; icon: string }> = {
  Facebook: { tone: 'blue', icon: '📘' },
  TikTok:   { tone: 'violet', icon: '🎵' },
  Other:    { tone: 'slate', icon: '🛒' },
};

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? 'শুভ সকাল' : h < 17 ? 'শুভ দুপুর' : h < 20 ? 'শুভ সন্ধ্যা' : 'শুভ রাত্রি';
}

export default function Dashboard() {
  const { sales, expenses, products, loading, error } = useBusinessData();
  const [kind, setKind] = useState<'day' | 'month' | 'all'>('month');
  const today = todayStr();
  const thisMonth = monthNow();

  const range: Range = useMemo(
    () => (kind === 'day' ? { kind: 'day', date: today } : kind === 'month' ? { kind: 'month', month: thisMonth } : { kind: 'all' }),
    [kind, today, thisMonth]
  );

  const salesR = useMemo(() => sales.filter(s => inRange(s.date, range)), [sales, range]);
  const expR = useMemo(() => expenses.filter(e => inRange(e.date, range)), [expenses, range]);
  const sm = useMemo(() => summarize(salesR, expR), [salesR, expR]);
  const chan = useMemo(() => byChannel(salesR, expR), [salesR, expR]);
  const stock = useMemo(() => stockSummary(products), [products]);
  const courierStatus = useMemo(() => courierStatusCounts(salesR), [salesR]);
  const trend = useMemo(() => dailySeries(sales, expenses, datesOf({ kind: 'all' }, today).slice(-14)), [sales, expenses, today]);
  const trendMax = Math.max(1, ...trend.map(d => d.sales));

  if (loading) return <Spinner icon="📊" text="ড্যাশবোর্ড লোড হচ্ছে..." />;
  if (error) return <Card className="p-6 text-sm text-rose-700">ডেটা আনতে সমস্যা: {error}</Card>;

  const periodLabel = kind === 'day' ? 'আজ' : kind === 'month' ? monthLabel(thisMonth) : 'সব সময়';
  const recent: Sale[] = salesR.slice(0, 8);

  return (
    <div className="pb-8">
      <PageHeader
        title={`${greeting()}, Taqwa Gadget Zone`}
        subtitle={`${periodLabel} — ব্যবসার এক নজরে`}
        actions={
          <>
            <Chip active={kind === 'day'} onClick={() => setKind('day')}>আজ</Chip>
            <Chip active={kind === 'month'} onClick={() => setKind('month')}>এই মাস</Chip>
            <Chip active={kind === 'all'} onClick={() => setKind('all')}>সব</Chip>
          </>
        }
      />

      {/* Alerts */}
      {(stock.out.length > 0 || stock.low.length > 0) && (
        <div className="mb-5 grid grid-cols-1 gap-3 md:grid-cols-2">
          {stock.out.length > 0 && (
            <Link to="/products" className="flex items-center justify-between gap-3 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3">
              <div className="min-w-0">
                <div className="text-sm font-bold text-rose-700">🚫 স্টক শেষ — {stock.out.length}টি প্রোডাক্ট</div>
                <div className="truncate text-xs text-rose-600">{stock.out.slice(0, 4).map(p => p.name).join(', ')}</div>
              </div>
              <span className="shrink-0 rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-semibold text-white">দেখুন</span>
            </Link>
          )}
          {stock.low.length > 0 && (
            <Link to="/products" className="flex items-center justify-between gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3">
              <div className="min-w-0">
                <div className="text-sm font-bold text-amber-800">⚠️ কম স্টক — {stock.low.length}টি প্রোডাক্ট</div>
                <div className="truncate text-xs text-amber-700">{stock.low.slice(0, 4).map(p => p.name).join(', ')}</div>
              </div>
              <span className="shrink-0 rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white">দেখুন</span>
            </Link>
          )}
        </div>
      )}

      {/* KPI row 1 */}
      <div className="mb-3 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="মোট বিক্রি" value={BDT(sm.sales)} sub={`${sm.orders - sm.lost} টি কার্যকর অর্ডার`} tone="blue" icon="💰" />
        <StatCard label="নেট লাভ" value={BDT(sm.netProfit)} sub={`সেলস লাভ ${BDT(sm.salesProfit)} − খরচ ${BDT(sm.expenses)}`}
          tone={sm.netProfit >= 0 ? 'green' : 'red'} icon="📈" />
        <StatCard label="মোট খরচ" value={BDT(sm.expenses)} sub={`বিজ্ঞাপন ${BDT(sm.adTotal)}`} tone="red" icon="💸" />
        <StatCard label="অর্ডার" value={`${sm.orders}`} sub={`ডেলিভারি ${sm.delivered} · ফেরত/বাতিল ${sm.lost}`} tone="violet" icon="🛒" />
      </div>

      {/* KPI row 2 */}
      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="অগ্রিম আদায়" value={BDT(sm.advance)} sub="কাস্টমার আগেই দিয়েছে" tone="green" icon="💳" />
        <StatCard label="COD বাকি" value={BDT(sm.codPending)} sub={`${sm.open}টি কুরিয়ারে আছে`} tone="amber" icon="🏍️" />
        <StatCard label="COD আদায়" value={BDT(sm.codCollected)} sub="ডেলিভারি হয়েছে" tone="green" icon="✅" />
        <StatCard label="স্টক ভ্যালু" value={BDT(stock.value)} sub={`${stock.pieces.toLocaleString('en-IN')} পিস · ${products.length}টি প্রোডাক্ট`} tone="slate" icon="📦" />
      </div>

      {/* Channel performance */}
      <div className="mb-5">
        <h2 className="mb-3 text-sm font-bold text-slate-700">চ্যানেল অনুযায়ী লাভ</h2>
        <div className="grid gap-3 md:grid-cols-3">
          {CHANNELS.map(ch => {
            const r = chan[ch];
            const st = CHANNEL_STYLE[ch];
            return (
              <Card key={ch} className="p-4">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-2 text-sm font-bold text-slate-900">{st.icon} {ch === 'Other' ? 'অন্যান্য / সরাসরি' : ch}</span>
                  <Badge tone={st.tone}>{r.orders} অর্ডার</Badge>
                </div>
                <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                  <div><div className="text-[11px] text-slate-500">সেলস লাভ</div><div className="text-sm font-bold tabular-nums text-slate-900">{BDT(r.profit)}</div></div>
                  <div><div className="text-[11px] text-slate-500">বিজ্ঞাপন</div><div className="text-sm font-bold tabular-nums text-rose-600">{BDT(r.ads)}</div></div>
                  <div><div className="text-[11px] text-slate-500">নিট</div><div className={cn('text-sm font-bold tabular-nums', r.net >= 0 ? 'text-emerald-700' : 'text-rose-600')}>{BDT(r.net)}</div></div>
                </div>
                {ch !== 'Other' && (
                  <div className="mt-3 text-[11px] text-slate-500">ROAS: <b className="text-slate-800">{r.roas ? r.roas.toFixed(2) + 'x' : '—'}</b> <span className="text-slate-400">(বিক্রি ÷ বিজ্ঞাপন)</span></div>
                )}
              </Card>
            );
          })}
        </div>
      </div>

      <div className="mb-5 grid gap-4 lg:grid-cols-5">
        {/* Trend */}
        <Card className="p-4 lg:col-span-3">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-700">গত ১৪ দিনের বিক্রি ও লাভ</h2>
            <div className="flex items-center gap-3 text-[11px] text-slate-500">
              <span className="flex items-center gap-1"><i className="h-2 w-2 rounded-sm bg-blue-500" />বিক্রি</span>
              <span className="flex items-center gap-1"><i className="h-2 w-2 rounded-sm bg-emerald-500" />লাভ</span>
            </div>
          </div>
          <div className="flex h-44 items-end gap-1.5">
            {trend.map(d => (
              <div key={d.date} className="group flex h-full flex-1 flex-col items-center justify-end gap-1" title={`${d.date}\nবিক্রি ${BDT(d.sales)}\nলাভ ${BDT(d.profit)}\nখরচ ${BDT(d.expenses)}`}>
                <div className="flex h-full w-full items-end justify-center gap-0.5">
                  <div className="w-1/2 rounded-t bg-blue-500/80 transition group-hover:bg-blue-600" style={{ height: `${(d.sales / trendMax) * 100}%`, minHeight: d.sales ? 3 : 0 }} />
                  <div className="w-1/2 rounded-t bg-emerald-500/80 transition group-hover:bg-emerald-600" style={{ height: `${(Math.max(0, d.profit) / trendMax) * 100}%`, minHeight: d.profit > 0 ? 3 : 0 }} />
                </div>
                <span className="text-[9px] text-slate-400 tabular-nums">{d.date.slice(8)}</span>
              </div>
            ))}
          </div>
        </Card>

        {/* Courier status */}
        <Card className="p-4 lg:col-span-2">
          <h2 className="mb-3 text-sm font-bold text-slate-700">কুরিয়ার স্ট্যাটাস</h2>
          {Object.keys(courierStatus).length === 0 ? (
            <div className="py-8 text-center text-sm text-slate-400">এই সময়ে কুরিয়ার অর্ডার নেই</div>
          ) : (
            <ul className="space-y-2">
              {Object.entries(courierStatus).sort((a, b) => b[1] - a[1]).map(([k, v]) => {
                const st = STATUS_LABEL[k] ?? { label: k, tone: 'slate' as const };
                const pct = Math.round((v / Math.max(1, salesR.filter(isCourier).length)) * 100);
                return (
                  <li key={k}>
                    <div className="mb-1 flex items-center justify-between text-xs">
                      <Badge tone={st.tone}>{st.label}</Badge>
                      <span className="font-semibold tabular-nums text-slate-700">{v} · {pct}%</span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
                      <div className="h-full rounded-full bg-emerald-500" style={{ width: `${pct}%` }} />
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      </div>

      {/* Recent orders */}
      <Card className="overflow-hidden">
        <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
          <h2 className="text-sm font-bold text-slate-800">সাম্প্রতিক অর্ডার</h2>
          <Link to="/sales" className="text-xs font-semibold text-emerald-700 hover:underline">সব দেখুন →</Link>
        </div>
        {recent.length === 0 ? (
          <Empty icon="🛵" text="এই সময়ে কোনো অর্ডার নেই" />
        ) : (
          <>
            <table className="hidden w-full text-sm md:table">
              <thead className="bg-slate-50 text-left text-xs font-semibold text-slate-500">
                <tr>
                  <th className="px-4 py-2.5">ইনভয়েস / তারিখ</th>
                  <th className="px-4 py-2.5">কাস্টমার</th>
                  <th className="px-4 py-2.5">প্রোডাক্ট</th>
                  <th className="px-4 py-2.5">চ্যানেল</th>
                  <th className="px-4 py-2.5 text-right">বিল</th>
                  <th className="px-4 py-2.5 text-right">লাভ</th>
                  <th className="px-4 py-2.5">স্ট্যাটাস</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {recent.map(s => <OrderRow key={s.id} s={s} />)}
              </tbody>
            </table>
            <ul className="divide-y divide-slate-100 md:hidden">
              {recent.map(s => <OrderCard key={s.id} s={s} />)}
            </ul>
          </>
        )}
      </Card>
    </div>
  );
}

function statusBadge(s: Sale) {
  if (!isCourier(s)) return <Badge tone="green">সরাসরি</Badge>;
  const st = STATUS_LABEL[s.courierDeliveryStatus || 'pending'] ?? { label: s.courierDeliveryStatus || '—', tone: 'slate' as const };
  return <Badge tone={st.tone}>{st.label}</Badge>;
}

function itemsText(s: Sale) {
  if (s.items?.length) return s.items.map(i => `${i.model || i.productName}${i.color ? ` (${i.color})` : ''}`).join(', ');
  return s.model || '—';
}

function OrderRow({ s }: { s: Sale }) {
  return (
    <tr className={cn('hover:bg-slate-50/70', isLost(s) && 'opacity-60')}>
      <td className="px-4 py-2.5">
        <div className="font-mono text-xs font-semibold text-emerald-900">{s.invoice || s.id.slice(0, 8).toUpperCase()}</div>
        <div className="text-[11px] text-slate-400 tabular-nums">{s.date}</div>
      </td>
      <td className="px-4 py-2.5">
        <div className="font-medium text-slate-900">{s.customerRef || 'সরাসরি বিক্রয়'}</div>
        <div className="text-[11px] text-slate-500">{s.customerPhone || ''}</div>
      </td>
      <td className="max-w-[220px] truncate px-4 py-2.5 text-xs text-slate-700" title={itemsText(s)}>{itemsText(s)}</td>
      <td className="px-4 py-2.5 text-xs">{s.customerChannel || '—'}</td>
      <td className="px-4 py-2.5 text-right font-semibold tabular-nums">{BDT(s.salesAmount || 0)}</td>
      <td className={cn('px-4 py-2.5 text-right font-bold tabular-nums', (s.netProfit || 0) >= 0 ? 'text-emerald-700' : 'text-rose-600')}>{BDT(s.netProfit || 0)}</td>
      <td className="px-4 py-2.5">{statusBadge(s)}</td>
    </tr>
  );
}

function OrderCard({ s }: { s: Sale }) {
  return (
    <li className={cn('flex items-start justify-between gap-3 px-4 py-3', isLost(s) && 'opacity-60')}>
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="font-mono text-[11px] font-semibold text-emerald-900">{s.invoice || s.id.slice(0, 8).toUpperCase()}</span>
          {statusBadge(s)}
        </div>
        <div className="mt-1 truncate text-sm font-medium text-slate-900">{s.customerRef || 'সরাসরি বিক্রয়'}</div>
        <div className="truncate text-xs text-slate-500">{itemsText(s)}</div>
      </div>
      <div className="shrink-0 text-right">
        <div className="text-sm font-bold tabular-nums">{BDT(s.salesAmount || 0)}</div>
        <div className={cn('text-xs font-semibold tabular-nums', (s.netProfit || 0) >= 0 ? 'text-emerald-700' : 'text-rose-600')}>লাভ {BDT(s.netProfit || 0)}</div>
      </div>
    </li>
  );
}
