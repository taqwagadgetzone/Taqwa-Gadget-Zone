import { useMemo, useState } from 'react';
import { useBusinessData } from '../hooks/useBusinessData';
import {
  summarize, byChannel, dailySeries, datesOf, inRange, expenseByCategory, topProducts,
  courierStatusCounts, isCourier, shiftMonth, downloadCSV, saleCost, saleProfit, productPnL,
  AD_CATEGORIES, CHANNELS, type Range, type Channel,
} from '../services/accounting';
import {
  BDT, USD, cn, inputCls, Card, PageHeader, StatCard, Badge, Chip, Button, Spinner, Empty,
} from '../components/ui';
const todayStr = () => new Date().toISOString().split('T')[0];
const monthNow = () => todayStr().slice(0, 7);
const monthLabel = (m: string) => new Date(m + '-01').toLocaleString('bn-BD', { month: 'long', year: 'numeric' });
const pct = (n: number, base: number) => (base ? `${Math.round((n / base) * 100)}%` : '—');
const delta = (cur: number, prev: number) => {
  if (!prev) return cur ? '+নতুন' : '—';
  const d = Math.round(((cur - prev) / Math.abs(prev)) * 100);
  return `${d >= 0 ? '▲' : '▼'} ${Math.abs(d)}%`;
};

export default function Reports() {
  const { sales, expenses, products, loading, error } = useBusinessData();
  const [kind, setKind] = useState<'day' | 'month' | 'all'>('month');
  const [day, setDay] = useState(todayStr());
  const [month, setMonth] = useState(monthNow());
  const today = todayStr();

  const range: Range = useMemo(
    () => (kind === 'day' ? { kind: 'day', date: day } : kind === 'month' ? { kind: 'month', month } : { kind: 'all' }),
    [kind, day, month]
  );

  const salesR = useMemo(() => sales.filter(s => inRange(s.date, range)), [sales, range]);
  const expR = useMemo(() => expenses.filter(e => inRange(e.date, range)), [expenses, range]);
  const sm = useMemo(() => summarize(salesR, expR), [salesR, expR]);
  const chan = useMemo(() => byChannel(salesR, expR), [salesR, expR]);
  const days = useMemo(() => dailySeries(sales, expenses, datesOf(range, today)).reverse(), [sales, expenses, range, today]);
  const dayMax = Math.max(1, ...days.map(d => d.sales));
  const cats = useMemo(() => expenseByCategory(expR), [expR]);
  const top = useMemo(() => topProducts(salesR, 10), [salesR]);
  const pnl = useMemo(() => productPnL(salesR, expR, products), [salesR, expR, products]);
  const courier = useMemo(() => courierStatusCounts(salesR), [salesR]);

  // আগের মাসের তুলনা (শুধু মাস ভিউতে)
  const prev = useMemo(() => {
    if (kind !== 'month') return null;
    const pm = shiftMonth(month, -1);
    const pr: Range = { kind: 'month', month: pm };
    return summarize(sales.filter(s => inRange(s.date, pr)), expenses.filter(e => inRange(e.date, pr)));
  }, [kind, month, sales, expenses]);

  if (loading) return <Spinner icon="📅" text="রিপোর্ট তৈরি হচ্ছে..." />;
  if (error) return <Card className="p-6 text-sm text-rose-700">ডেটা আনতে সমস্যা: {error}</Card>;

  const label = kind === 'day' ? day : kind === 'month' ? monthLabel(month) : 'সব সময়';

  const exportCSV = () => {
    const rows: (string | number)[][] = [
      ['রিপোর্ট', label],
      [],
      ['সারাংশ'],
      ['মোট বিক্রি', sm.sales], ['পণ্যের ক্রয়মূল্য', sm.cogs], ['কুরিয়ার চার্জ', sm.courier],
      ['কন্ডিশন চার্জ', sm.condition], ['সেলস লাভ', sm.salesProfit], ['মোট খরচ', sm.expenses],
      ['বিজ্ঞাপন (Facebook)', sm.ads.Facebook], ['বিজ্ঞাপন (TikTok)', sm.ads.TikTok],
      ['নেট লাভ', sm.netProfit], ['অগ্রিম আদায়', sm.advance], ['COD বাকি', sm.codPending], ['COD আদায়', sm.codCollected],
      [],
      ['সেলস তালিকা'],
      ['তারিখ', 'ইনভয়েস', 'কাস্টমার', 'ফোন', 'চ্যানেল', 'প্রোডাক্ট', 'বিল', 'অগ্রিম', 'COD', 'কুরিয়ার চার্জ', 'কন্ডিশন', 'ক্রয়মূল্য', 'লাভ', 'স্ট্যাটাস'],
      ...salesR.map(s => [
        s.date, s.invoice || '', s.customerRef || '', s.customerPhone || '', s.customerChannel || '',
        s.items?.length ? s.items.map(i => i.model || i.productName).join(' + ') : s.model || '',
        s.salesAmount || 0, s.advanceAmount || 0, s.codAmount || 0, s.courierCharge || 0,
        s.courierConditionCost || 0, saleCost(s), saleProfit(s), s.courierDeliveryStatus || 'সরাসরি',
      ]),
      [],
      ['খরচের তালিকা'],
      ['তারিখ', 'ক্যাটাগরি', 'মডেল', 'বিবরণ', 'ডলার', 'রেট', 'টাকা'],
      ...expR.map(e => [e.date, e.category, e.targetModel || '', e.description, e.dollarAmount || '', e.dollarRate || '', e.amount]),
    ];
    downloadCSV(`taqwa-report-${kind === 'day' ? day : kind === 'month' ? month : 'all'}.csv`, rows);
  };

  return (
    <div className="pb-8">
      <PageHeader
        title="রিপোর্ট ও লাভ-ক্ষতি"
        subtitle={`${label} — বিক্রি, খরচ, চ্যানেল লাভ ও নগদ হিসাব`}
        actions={
          <>
            <div className="flex items-center gap-2">
              <Chip active={kind === 'day'} onClick={() => setKind('day')}>দৈনিক</Chip>
              <Chip active={kind === 'month'} onClick={() => setKind('month')}>মাসিক</Chip>
              <Chip active={kind === 'all'} onClick={() => setKind('all')}>সব</Chip>
            </div>
            {kind === 'day' && (
              <input type="date" value={day} onChange={e => setDay(e.target.value)} className={cn(inputCls, 'w-auto py-1.5 text-xs')} />
            )}
            {kind === 'month' && (
              <input type="month" value={month} onChange={e => setMonth(e.target.value)} className={cn(inputCls, 'w-auto py-1.5 text-xs')} />
            )}
            <Button variant="accent" onClick={exportCSV} className="!py-1.5 !text-xs">⬇ CSV ডাউনলোড</Button>
          </>
        }
      />

      {/* KPI */}
      <div className="mb-3 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="মোট বিক্রি" value={BDT(sm.sales)}
          sub={prev ? `আগের মাস ${delta(sm.sales, prev.sales)}` : `${sm.orders - sm.lost} কার্যকর অর্ডার`} tone="blue" icon="💰" />
        <StatCard label="নেট লাভ" value={BDT(sm.netProfit)}
          sub={prev ? `আগের মাস ${delta(sm.netProfit, prev.netProfit)}` : 'সেলস লাভ − সব খরচ'}
          tone={sm.netProfit >= 0 ? 'green' : 'red'} icon="📈" />
        <StatCard label="মোট খরচ" value={BDT(sm.expenses)}
          sub={prev ? `আগের মাস ${delta(sm.expenses, prev.expenses)}` : `${expR.length}টি এন্ট্রি`} tone="red" icon="💸" />
        <StatCard label="ডলার পেমেন্ট" value={USD(sm.usd)} sub="বিজ্ঞাপনের ডলার" tone="violet" icon="💵" />
      </div>
      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="অগ্রিম আদায়" value={BDT(sm.advance)} sub="কুরিয়ার আগেই পাওয়া" tone="green" icon="💳" />
        <StatCard label="COD বাকি" value={BDT(sm.codPending)} sub={`${sm.open}টি কুরিয়ারে`} tone="amber" icon="🏍️" />
        <StatCard label="COD আদায়" value={BDT(sm.codCollected)} sub="ডেলিভারি হওয়া" tone="green" icon="✅" />
        <StatCard label="অর্ডার" value={`${sm.orders}`} sub={`ডেলিভারি ${sm.delivered} · ফেরত/বাতিল ${sm.lost}`} tone="slate" icon="🛒" />
      </div>

      {/* Channel */}
      <h2 className="mb-3 text-sm font-bold text-slate-700">চ্যানেল অনুযায়ী লাভ</h2>
      <div className="mb-5 grid gap-3 md:grid-cols-3">
        {CHANNELS.map(ch => <ChannelCard key={ch} ch={ch} r={chan[ch]} />)}
      </div>

      <div className="mb-5 grid gap-4 xl:grid-cols-5">
        {/* P&L */}
        <Card className="p-4 xl:col-span-3">
          <h2 className="mb-3 text-sm font-bold text-slate-800">লাভ-ক্ষতির বিবরণী (P&amp;L)</h2>
          <PLTable sm={sm} />
        </Card>

        {/* Cash */}
        <Card className="p-4 xl:col-span-2">
          <h2 className="mb-1 text-sm font-bold text-slate-800">নগদ হিসাব</h2>
          <p className="mb-3 text-[11px] text-slate-400">আনুমানিক — স্টক কেনার টাকা এখানে ধরা নেই</p>
          <div className="space-y-2.5 text-sm">
            <Row label="অগ্রিম আদায়" value={sm.advance} tone="green" />
            <Row label="COD আদায় (ডেলিভারি হওয়া)" value={sm.codCollected} tone="green" />
            <Row label="মোট নগদ আয়" value={sm.advance + sm.codCollected} bold />
            <Row label="খরচ পরিশোধ" value={-sm.expenses} tone="red" />
            <div className="my-1 border-t border-slate-100" />
            <Row label="নগদ উদ্বৃত্ত" value={sm.advance + sm.codCollected - sm.expenses} bold tone={sm.advance + sm.codCollected - sm.expenses >= 0 ? 'green' : 'red'} />
            <div className="mt-3 rounded-xl bg-amber-50 p-3 text-xs text-amber-800">
              কুরিয়ারে আছে <b>{BDT(sm.codPending)}</b> — ডেলিভারি হলে এটি আদায় হবে।
            </div>
          </div>
        </Card>
      </div>

      <div className="mb-5 grid gap-4 xl:grid-cols-2">
        {/* Expense by category */}
        <Card className="p-4">
          <h2 className="mb-3 text-sm font-bold text-slate-800">খরচ ক্যাটাগরি অনুযায়ী</h2>
          {cats.length === 0 ? <div className="py-6 text-center text-sm text-slate-400">এই সময়ে খরচ নেই</div> : (
            <ul className="space-y-3">
              {cats.map(([c, v]) => (
                <li key={c}>
                  <div className="mb-1 flex items-center justify-between text-xs">
                    <span className="flex items-center gap-1.5 font-medium text-slate-700">
                      {AD_CATEGORIES.includes(c) && <Badge tone={c === 'TikTok Ads' ? 'violet' : 'blue'}>বিজ্ঞাপন</Badge>}
                      {c}
                    </span>
                    <span className="font-bold tabular-nums">{BDT(v)} <span className="font-normal text-slate-400">· {pct(v, sm.expenses)}</span></span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                    <div className={cn('h-full rounded-full', AD_CATEGORIES.includes(c) ? 'bg-blue-500' : 'bg-amber-500')}
                      style={{ width: `${sm.expenses ? (v / sm.expenses) * 100 : 0}%` }} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>

        {/* Courier */}
        <Card className="p-4">
          <h2 className="mb-3 text-sm font-bold text-slate-800">কুরিয়ার স্ট্যাটাস</h2>
          {Object.keys(courier).length === 0 ? <div className="py-6 text-center text-sm text-slate-400">কুরিয়ার অর্ডার নেই</div> : (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {Object.entries(courier).sort((a, b) => b[1] - a[1]).map(([k, v]) => (
                <div key={k} className="rounded-xl bg-slate-50 p-3">
                  <div className="text-[11px] text-slate-500">{k.replace(/_/g, ' ')}</div>
                  <div className="text-lg font-bold tabular-nums">{v}</div>
                  <div className="text-[11px] text-slate-400">{pct(v, salesR.filter(isCourier).length)}</div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* Top products */}
      <Card className="mb-5 overflow-hidden">
        <div className="border-b border-slate-100 px-4 py-3"><h2 className="text-sm font-bold text-slate-800">সেরা প্রোডাক্ট</h2></div>
        {top.length === 0 ? <Empty icon="📦" text="এই সময়ে বিক্রি নেই" /> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs font-semibold text-slate-500">
                <tr><th className="px-4 py-2.5">#</th><th className="px-4 py-2.5">প্রোডাক্ট</th><th className="px-4 py-2.5 text-right">বিক্রি (পিস)</th><th className="px-4 py-2.5 text-right">আয়</th><th className="px-4 py-2.5 text-right">লাভ</th></tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {top.map((p, i) => (
                  <tr key={p.name} className="hover:bg-slate-50/70">
                    <td className="px-4 py-2.5 text-slate-400">{i + 1}</td>
                    <td className="px-4 py-2.5 font-medium text-slate-900">{p.name}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums">{p.qty}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums">{BDT(p.revenue)}</td>
                    <td className={cn('px-4 py-2.5 text-right font-semibold tabular-nums', p.profit >= 0 ? 'text-emerald-700' : 'text-rose-600')}>{BDT(p.profit)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {products.length > 0 && <div className="border-t border-slate-100 px-4 py-2 text-[11px] text-slate-400">স্টক ভ্যালু (বর্তমান): {BDT(products.reduce((s, p) => s + (p.stockValue || 0), 0))}</div>}
      </Card>

      {/* প্রোডাক্ট-ভিত্তিক লাভ-ক্ষতি — কোন প্রোডাক্টে কত খরচ, কত লাভ */}
      <Card className="mb-5 overflow-hidden">
        <div className="border-b border-slate-100 px-4 py-3">
          <h2 className="text-sm font-bold text-slate-800">প্রোডাক্ট অনুযায়ী লাভ-ক্ষতি</h2>
          <p className="mt-0.5 text-[11px] text-slate-500">
            সেলস লাভে কুরিয়ার, COD ও অন্যান্য সেল খরচ বাদ দেওয়া। প্রোডাক্টের নামে যুক্ত খরচ সেই প্রোডাক্টে যায়।
          </p>
        </div>
        {pnl.rows.length === 0 && pnl.unassignedExpenses === 0 ? (
          <Empty icon="📊" text="এই সময়ে প্রোডাক্টের হিসাব নেই" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[680px] text-sm">
              <thead className="bg-slate-50 text-left text-xs font-semibold text-slate-500">
                <tr>
                  <th className="px-4 py-2.5">প্রোডাক্ট</th>
                  <th className="px-4 py-2.5 text-right">পিস</th>
                  <th className="px-4 py-2.5 text-right">বিক্রয়</th>
                  <th className="px-4 py-2.5 text-right">ক্রয়মূল্য</th>
                  <th className="px-4 py-2.5 text-right">সেলস লাভ</th>
                  <th className="px-4 py-2.5 text-right">খরচ</th>
                  <th className="px-4 py-2.5 text-right">নেট লাভ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {pnl.rows.map(r => (
                  <tr key={r.name} className="hover:bg-slate-50/70">
                    <td className="px-4 py-2.5 font-medium text-slate-900">{r.name}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums">{r.pieces || '—'}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums">{r.revenue ? BDT(r.revenue) : '—'}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums">{r.cogs ? BDT(r.cogs) : '—'}</td>
                    <td className={cn('px-4 py-2.5 text-right tabular-nums', r.salesProfit >= 0 ? 'text-emerald-700' : 'text-rose-600')}>{BDT(r.salesProfit)}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-rose-600">{r.expenses ? BDT(r.expenses) : '—'}</td>
                    <td className={cn('px-4 py-2.5 text-right font-semibold tabular-nums', r.net >= 0 ? 'text-emerald-700' : 'text-rose-600')}>{BDT(r.net)}</td>
                  </tr>
                ))}
                {pnl.unassignedExpenses > 0 && (
                  <tr className="bg-amber-50/60">
                    <td className="px-4 py-2.5 font-medium text-amber-800">অন্য খরচ (প্রোডাক্টে বসানো নেই)</td>
                    <td className="px-4 py-2.5 text-right text-slate-400">—</td>
                    <td className="px-4 py-2.5 text-right text-slate-400">—</td>
                    <td className="px-4 py-2.5 text-right text-slate-400">—</td>
                    <td className="px-4 py-2.5 text-right text-slate-400">—</td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-rose-600">{BDT(pnl.unassignedExpenses)}</td>
                    <td className="px-4 py-2.5 text-right font-semibold tabular-nums text-rose-600">{BDT(-pnl.unassignedExpenses)}</td>
                  </tr>
                )}
              </tbody>
              <tfoot className="border-t-2 border-slate-200 bg-slate-50 text-sm font-bold">
                <tr>
                  <td className="px-4 py-3">মোট</td>
                  <td className="px-4 py-3 text-right tabular-nums">{pnl.total.pieces}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{BDT(pnl.total.revenue)}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{BDT(pnl.total.cogs)}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{BDT(pnl.total.salesProfit)}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-rose-600">{BDT(pnl.total.expenses)}</td>
                  <td className={cn('px-4 py-3 text-right tabular-nums', pnl.total.net >= 0 ? 'text-emerald-700' : 'text-rose-600')}>{BDT(pnl.total.net)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </Card>

      {/* Daily */}
      <Card className="overflow-hidden">
        <div className="border-b border-slate-100 px-4 py-3">
          <h2 className="text-sm font-bold text-slate-800">
            {kind === 'day' ? 'দিনের হিসাব' : kind === 'month' ? 'দিন অনুযায়ী হিসাব' : 'শেষ ৩০ দিনের হিসাব'}
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-sm">
            <thead className="bg-slate-50 text-left text-xs font-semibold text-slate-500">
              <tr>
                <th className="px-4 py-2.5">তারিখ</th>
                <th className="px-4 py-2.5 text-right">অর্ডার</th>
                <th className="px-4 py-2.5 text-right">বিক্রি</th>
                <th className="px-4 py-2.5 text-right">লাভ</th>
                <th className="px-4 py-2.5 text-right">খরচ</th>
                <th className="px-4 py-2.5 text-right">নিট</th>
                <th className="w-40 px-4 py-2.5">বিক্রির গ্রাফ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {days.map(d => (
                <tr key={d.date} className={cn('hover:bg-slate-50/70', d.date === today && 'bg-emerald-50/50')}>
                  <td className="px-4 py-2.5 tabular-nums">{d.date}{d.date === today && <span className="ml-2 text-[10px] font-bold text-emerald-700">আজ</span>}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{d.orders || '—'}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{d.sales ? BDT(d.sales) : '—'}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-emerald-700">{d.profit ? BDT(d.profit) : '—'}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-rose-600">{d.expenses ? BDT(d.expenses) : '—'}</td>
                  <td className={cn('px-4 py-2.5 text-right font-semibold tabular-nums', d.net >= 0 ? 'text-slate-900' : 'text-rose-600')}>{d.sales || d.expenses ? BDT(d.net) : '—'}</td>
                  <td className="px-4 py-2.5">
                    <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                      <div className="h-full rounded-full bg-blue-500/80" style={{ width: `${(d.sales / dayMax) * 100}%` }} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

function ChannelCard({ ch, r }: { ch: Channel; r: ReturnType<typeof byChannel>[Channel] }) {
  const tone = ch === 'Facebook' ? 'blue' : ch === 'TikTok' ? 'violet' : 'slate';
  const icon = ch === 'Facebook' ? '📘' : ch === 'TikTok' ? '🎵' : '🛒';
  return (
    <Card className="p-4">
      <div className="mb-3 flex items-center justify-between">
        <span className="text-sm font-bold text-slate-900">{icon} {ch === 'Other' ? 'অন্যান্য / সরাসরি' : ch}</span>
        <Badge tone={tone}>{r.orders} অর্ডার</Badge>
      </div>
      <dl className="space-y-1.5 text-sm">
        <div className="flex justify-between"><dt className="text-slate-500">বিক্রি</dt><dd className="font-semibold tabular-nums">{BDT(r.sales)}</dd></div>
        <div className="flex justify-between"><dt className="text-slate-500">সেলস লাভ</dt><dd className="font-semibold tabular-nums text-emerald-700">{BDT(r.profit)}</dd></div>
        {ch !== 'Other' && <div className="flex justify-between"><dt className="text-slate-500">বিজ্ঞাপন খরচ</dt><dd className="font-semibold tabular-nums text-rose-600">− {BDT(r.ads)}</dd></div>}
        <div className="flex justify-between border-t border-slate-100 pt-1.5"><dt className="font-semibold text-slate-700">নিট লাভ</dt>
          <dd className={cn('font-bold tabular-nums', r.net >= 0 ? 'text-emerald-700' : 'text-rose-600')}>{BDT(r.net)}</dd></div>
      </dl>
      {ch !== 'Other' && <div className="mt-2 text-[11px] text-slate-500">ROAS <b className="text-slate-800">{r.roas ? r.roas.toFixed(2) + 'x' : '—'}</b></div>}
    </Card>
  );
}

function Row({ label, value, bold, tone }: { label: string; value: number; bold?: boolean; tone?: 'green' | 'red' }) {
  return (
    <div className="flex items-center justify-between">
      <span className={cn(bold ? 'font-bold text-slate-900' : 'text-slate-600')}>{label}</span>
      <span className={cn('tabular-nums', bold ? 'font-bold' : 'font-semibold',
        tone === 'green' && 'text-emerald-700', tone === 'red' && 'text-rose-600')}>{BDT(value)}</span>
    </div>
  );
}

function PLTable({ sm }: { sm: ReturnType<typeof summarize> }) {
  const base = sm.sales;
  const otherExp = sm.expenses - sm.adTotal;
  const lines: { label: string; value: number; kind: 'add' | 'sub' | 'total' | 'final' }[] = [
    { label: 'মোট বিক্রি (ডেলিভারি সহ)', value: sm.sales, kind: 'add' },
    { label: '− পণ্যের ক্রয়মূল্য', value: sm.cogs, kind: 'sub' },
    { label: '− কুরিয়ার চার্জ', value: sm.courier, kind: 'sub' },
    { label: '− COD কন্ডিশন চার্জ', value: sm.condition, kind: 'sub' },
    { label: '− সেল-ভিত্তিক অন্যান্য খরচ', value: sm.otherCost, kind: 'sub' },
    { label: '= সেলস লাভ', value: sm.salesProfit, kind: 'total' },
    { label: '− Facebook বিজ্ঞাপন', value: sm.ads.Facebook, kind: 'sub' },
    { label: '− TikTok বিজ্ঞাপন', value: sm.ads.TikTok, kind: 'sub' },
    { label: '− অন্যান্য খরচ (প্যাকেজিং, রিটার্ন ইত্যাদি)', value: otherExp, kind: 'sub' },
    { label: '= নেট লাভ', value: sm.netProfit, kind: 'final' },
  ];
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <tbody className="divide-y divide-slate-100">
          {lines.map(l => (
            <tr key={l.label} className={cn(
              l.kind === 'total' && 'bg-slate-50',
              l.kind === 'final' && 'bg-emerald-900 text-white'
            )}>
              <td className={cn('py-2.5 pl-3', l.kind === 'final' ? 'font-bold' : l.kind === 'total' ? 'font-bold text-slate-900' : 'text-slate-600')}>{l.label}</td>
              <td className={cn('py-2.5 text-right tabular-nums pr-3 font-semibold',
                l.kind === 'sub' && 'text-rose-600', l.kind === 'final' && (l.value >= 0 ? 'text-emerald-300' : 'text-rose-300'),
                l.kind === 'total' && 'text-emerald-700')}>{BDT(l.value)}</td>
              <td className={cn('w-16 py-2.5 pr-3 text-right text-[11px]', l.kind === 'final' ? 'text-emerald-200' : 'text-slate-400')}>{pct(l.value, base)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
