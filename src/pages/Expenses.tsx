import { useEffect, useMemo, useState } from 'react';
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc } from 'firebase/firestore';
import { db } from '../firebase';
import type { Expense } from '../types';
import {
  BDT, USD, cn, inputCls, labelCls, Card, PageHeader, StatCard, Badge, Chip,
  Button, IconButton, Modal, Empty, Spinner,
} from '../components/ui';

// ---- Categories (আপনার পুরনো সিস্টেম অনুযায়ী) ----
type Tone = 'blue' | 'violet' | 'amber' | 'red' | 'green' | 'slate';
const CATEGORIES: { key: string; icon: string; tone: Tone }[] = [
  { key: 'Facebook Ads',          icon: '📘', tone: 'blue' },
  { key: 'TikTok Ads',            icon: '🎵', tone: 'violet' },
  { key: 'Packaging',             icon: '📦', tone: 'amber' },
  { key: 'Return Parcel',         icon: '↩️', tone: 'red' },
  { key: 'Courier Other Expense', icon: '🚚', tone: 'amber' },
  { key: 'Shop Expense',          icon: '🏪', tone: 'green' },
  { key: 'Other',                 icon: '💸', tone: 'slate' },
];
const AD_CATEGORIES = ['Facebook Ads', 'TikTok Ads'];
const DEFAULT_CATEGORY = 'Other';

function catMeta(key: string) {
  return CATEGORIES.find(c => c.key === key) ?? { key, icon: '🧾', tone: 'slate' as Tone };
}

// ---- Helpers ----
const todayStr = () => new Date().toISOString().split('T')[0];
const monthNow = () => todayStr().slice(0, 7);
const num = (s: string) => {
  const v = parseFloat(s);
  return Number.isFinite(v) ? v : 0;
};
const round2 = (n: number) => Math.round(n * 100) / 100;

type ExpenseForm = {
  date: string;
  category: string;
  targetModel: string;
  description: string;
  amount: string;      // টাকা (ডলার না হলে)
  dollarAmount: string;
  dollarRate: string;
};

const emptyForm = (rate: string): ExpenseForm => ({
  date: todayStr(),
  category: DEFAULT_CATEGORY,
  targetModel: '',
  description: '',
  amount: '',
  dollarAmount: '',
  dollarRate: rate,
});

type Period = 'today' | 'month' | 'all';

export default function Expenses() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);

  // filters
  const [period, setPeriod] = useState<Period>('month');
  const [monthKey, setMonthKey] = useState(monthNow());
  const [catFilter, setCatFilter] = useState('');
  const [modelFilter, setModelFilter] = useState('');
  const [search, setSearch] = useState('');
  const [groupByModel, setGroupByModel] = useState(false);

  // modal
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<ExpenseForm>(emptyForm(''));
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  const load = async () => {
    const snap = await getDocs(collection(db, 'expenses'));
    const data = snap.docs.map(d => ({ id: d.id, ...d.data() })) as Expense[];
    data.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
    setExpenses(data);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  // সবচেয়ে সাম্প্রতিক ডলার রেট — নতুন এন্ট্রিতে আগেই বসে থাকবে
  const lastRate = useMemo(() => {
    const e = expenses.find(x => x.dollarRate);
    return e?.dollarRate ? String(e.dollarRate) : '';
  }, [expenses]);

  const models = useMemo(
    () => Array.from(new Set(expenses.map(e => e.targetModel).filter(Boolean) as string[])).sort(),
    [expenses]
  );

  // ---- filtering ----
  const inPeriod = (e: Expense) =>
    period === 'all' ? true :
    period === 'today' ? e.date === todayStr() :
    (e.date || '').startsWith(monthKey);

  const filtered = useMemo(() => expenses.filter(e => {
    if (!inPeriod(e)) return false;
    if (catFilter && e.category !== catFilter) return false;
    if (modelFilter && e.targetModel !== modelFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      const hay = `${e.description || ''} ${e.category || ''} ${e.targetModel || ''}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  }), [expenses, period, monthKey, catFilter, modelFilter, search]);

  // ---- totals ----
  const total = filtered.reduce((s, e) => s + (e.amount || 0), 0);
  const usdTotal = filtered.reduce((s, e) => s + (e.dollarAmount || 0), 0);
  const adSpend = filtered
    .filter(e => AD_CATEGORIES.includes(e.category))
    .reduce((s, e) => s + (e.amount || 0), 0);

  const catTotals = useMemo(() => {
    const m: Record<string, number> = {};
    filtered.forEach(e => { const k = e.category || DEFAULT_CATEGORY; m[k] = (m[k] || 0) + (e.amount || 0); });
    return m;
  }, [filtered]);

  const groups = useMemo(() => {
    const m = new Map<string, { total: number; items: Expense[] }>();
    filtered.forEach(e => {
      const k = e.targetModel || '— মডেল ছাড়া —';
      const g = m.get(k) ?? { total: 0, items: [] };
      g.total += e.amount || 0;
      g.items.push(e);
      m.set(k, g);
    });
    return Array.from(m.entries()).sort((a, b) => b[1].total - a[1].total);
  }, [filtered]);

  // ---- form ----
  const openAdd = () => {
    setEditId(null);
    setForm(emptyForm(lastRate));
    setOpen(true);
  };
  const openEdit = (e: Expense) => {
    setEditId(e.id);
    setForm({
      date: e.date || todayStr(),
      category: e.category || DEFAULT_CATEGORY,
      targetModel: e.targetModel || '',
      description: e.description || '',
      amount: e.dollarAmount ? '' : String(e.amount || ''),
      dollarAmount: e.dollarAmount ? String(e.dollarAmount) : '',
      dollarRate: e.dollarRate ? String(e.dollarRate) : '',
    });
    setOpen(true);
  };

  const dollarMode = num(form.dollarAmount) > 0 && num(form.dollarRate) > 0;
  const computedAmount = dollarMode ? round2(num(form.dollarAmount) * num(form.dollarRate)) : num(form.amount);

  const save = async () => {
    if (!form.description.trim()) return alert('বিবরণ লিখুন');
    if (computedAmount <= 0) return alert('পরিমাণ বা ডলার + রেট দিন');
    setSaving(true);
    const payload: Omit<Expense, 'id'> = {
      date: form.date,
      timestamp: new Date(form.date).getTime(),
      category: form.category,
      description: form.description.trim(),
      amount: computedAmount,
      targetModel: form.targetModel.trim() || undefined,
      dollarAmount: dollarMode ? num(form.dollarAmount) : undefined,
      dollarRate: dollarMode ? num(form.dollarRate) : undefined,
    };
    try {
      if (editId) await updateDoc(doc(db, 'expenses', editId), payload as Record<string, unknown>);
      else await addDoc(collection(db, 'expenses'), payload);
      await load();
      setOpen(false);
    } catch (err) {
      alert('সেভ করতে সমস্যা: ' + String(err));
    }
    setSaving(false);
  };

  const remove = async (id: string) => {
    if (!confirm('এই খরচ মুছে ফেলবেন? এটি ফিরিয়ে আনা যাবে না।')) return;
    setDeleting(id);
    try {
      await deleteDoc(doc(db, 'expenses', id));
      await load();
    } catch (err) {
      alert('মুছতে সমস্যা: ' + String(err));
    }
    setDeleting(null);
  };

  if (loading) return <Spinner icon="💸" text="খরচের তালিকা লোড হচ্ছে..." />;

  const periodLabel = period === 'today' ? 'আজ' : period === 'month' ? monthKey : 'সব সময়';

  return (
    <div className="pb-24 sm:pb-8">
      <PageHeader
        title="খরচ ব্যবস্থাপনা"
        subtitle="বিজ্ঞাপন, প্যাকেজিং, রিটার্ন ও অন্যান্য খরচ — মডেল ও ক্যাটাগরি অনুযায়ী"
        actions={
          <Button variant="accent" onClick={openAdd} className="w-full sm:w-auto">＋ নতুন খরচ</Button>
        }
      />

      {/* Summary */}
      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="মোট খরচ" value={BDT(total)} sub={`${filtered.length}টি এন্ট্রি · ${periodLabel}`} tone="red" icon="💸" />
        <StatCard label="বিজ্ঞাপন খরচ (টাকা)" value={BDT(adSpend)} sub="Facebook + TikTok" tone="blue" icon="📢" />
        <StatCard label="ডলার পেমেন্ট" value={USD(usdTotal)} sub="বিজ্ঞাপনের ডলার" tone="violet" icon="💵" />
        <StatCard label="মডেল সংখ্যা" value={`${new Set(filtered.map(e => e.targetModel).filter(Boolean)).size}`} sub="এই সময়ে খরচ হয়েছে" tone="green" icon="📱" />
      </div>

      {/* Category breakdown */}
      <div className="mb-5 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none]">
        {CATEGORIES.map(c => {
          const amt = catTotals[c.key] || 0;
          const active = catFilter === c.key;
          return (
            <button key={c.key} type="button" onClick={() => setCatFilter(active ? '' : c.key)}
              className={cn(
                'flex min-w-[118px] shrink-0 flex-col rounded-xl border px-3 py-2.5 text-left transition',
                active ? 'border-emerald-800 bg-emerald-900 text-white shadow' : 'border-slate-200 bg-white hover:border-slate-300'
              )}>
              <span className="text-base">{c.icon}</span>
              <span className={cn('mt-1 text-[11px] font-semibold', active ? 'text-emerald-100' : 'text-slate-500')}>{c.key}</span>
              <span className={cn('text-sm font-bold tabular-nums', active ? 'text-white' : 'text-slate-900')}>{BDT(amt)}</span>
            </button>
          );
        })}
      </div>

      {/* Toolbar */}
      <Card className="mb-4 p-3 sm:p-4">
        <div className="flex flex-wrap items-center gap-2">
          <Chip active={period === 'today'} onClick={() => setPeriod('today')}>আজ</Chip>
          <Chip active={period === 'month'} onClick={() => setPeriod('month')}>মাস</Chip>
          <Chip active={period === 'all'} onClick={() => setPeriod('all')}>সব</Chip>
          {period === 'month' && (
            <input type="month" value={monthKey} onChange={e => setMonthKey(e.target.value)}
              className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs" />
          )}
          <div className="ml-auto flex overflow-hidden rounded-lg border border-slate-200 text-xs">
            <button type="button" onClick={() => setGroupByModel(false)}
              className={cn('px-3 py-1.5 font-medium', !groupByModel ? 'bg-emerald-900 text-white' : 'bg-white text-slate-600')}>তালিকা</button>
            <button type="button" onClick={() => setGroupByModel(true)}
              className={cn('px-3 py-1.5 font-medium', groupByModel ? 'bg-emerald-900 text-white' : 'bg-white text-slate-600')}>মডেল অনুযায়ী</button>
          </div>
        </div>
        <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_200px]">
          <input type="search" value={search} onChange={e => setSearch(e.target.value)}
            placeholder="খুঁজুন — বিবরণ, ক্যাটাগরি, মডেল..." className={inputCls} />
          <select value={modelFilter} onChange={e => setModelFilter(e.target.value)} className={inputCls}>
            <option value="">সব মডেল ({models.length})</option>
            {models.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
        </div>
        {(catFilter || modelFilter || search) && (
          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-500">
            <span>ফিল্টার:</span>
            {catFilter && <Badge tone="blue">{catFilter} <button onClick={() => setCatFilter('')} className="ml-1">✕</button></Badge>}
            {modelFilter && <Badge tone="violet">{modelFilter} <button onClick={() => setModelFilter('')} className="ml-1">✕</button></Badge>}
            {search && <Badge tone="slate">"{search}" <button onClick={() => setSearch('')} className="ml-1">✕</button></Badge>}
          </div>
        )}
      </Card>

      {filtered.length === 0 && (
        <Card>
          <Empty icon="💸" text="এই ফিল্টারে কোনো খরচ নেই"
            action={<Button variant="primary" onClick={openAdd}>＋ নতুন খরচ যোগ করুন</Button>} />
        </Card>
      )}

      {/* ===== Group by model ===== */}
      {filtered.length > 0 && groupByModel && (
        <div className="space-y-4">
          {groups.map(([model, g]) => (
            <Card key={model} className="overflow-hidden">
              <div className="flex items-center justify-between gap-3 border-b border-slate-100 bg-slate-50 px-4 py-3">
                <div className="min-w-0">
                  <div className="truncate text-sm font-bold text-slate-900">{model}</div>
                  <div className="text-[11px] text-slate-500">{g.items.length}টি খরচ</div>
                </div>
                <div className="shrink-0 text-right">
                  <div className="text-sm font-bold tabular-nums text-rose-600">{BDT(g.total)}</div>
                  <div className="text-[11px] text-slate-400">মোট</div>
                </div>
              </div>
              <ExpenseRows items={g.items} onEdit={openEdit} onDelete={remove} deleting={deleting} />
            </Card>
          ))}
        </div>
      )}

      {/* ===== Flat list ===== */}
      {filtered.length > 0 && !groupByModel && (
        <Card className="overflow-hidden">
          {/* Desktop table */}
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs font-semibold text-slate-500">
                <tr>
                  <th className="px-4 py-3">তারিখ</th>
                  <th className="px-4 py-3">ক্যাটাগরি</th>
                  <th className="px-4 py-3">মডেল</th>
                  <th className="px-4 py-3">বিবরণ</th>
                  <th className="px-4 py-3 text-right">ডলার</th>
                  <th className="px-4 py-3 text-right">টাকা</th>
                  <th className="px-4 py-3 text-center">অ্যাকশন</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map(e => {
                  const m = catMeta(e.category);
                  return (
                    <tr key={e.id} className="hover:bg-slate-50/70">
                      <td className="whitespace-nowrap px-4 py-3 text-slate-600 tabular-nums">{e.date}</td>
                      <td className="px-4 py-3"><Badge tone={m.tone}>{m.icon} {e.category}</Badge></td>
                      <td className="px-4 py-3 text-slate-700">{e.targetModel || <span className="text-slate-300">—</span>}</td>
                      <td className="max-w-[260px] truncate px-4 py-3 font-medium text-slate-900" title={e.description}>{e.description}</td>
                      <td className="px-4 py-3 text-right text-xs text-slate-500 tabular-nums">
                        {e.dollarAmount ? `${USD(e.dollarAmount)} @ ${e.dollarRate}` : '—'}
                      </td>
                      <td className="px-4 py-3 text-right font-bold text-rose-600 tabular-nums">{BDT(e.amount || 0)}</td>
                      <td className="px-4 py-3">
                        <div className="flex justify-center gap-1.5">
                          <IconButton tone="blue" title="এডিট" onClick={() => openEdit(e)}>✏️</IconButton>
                          <IconButton tone="red" title="মুছুন" disabled={deleting === e.id} onClick={() => remove(e.id)}>
                            {deleting === e.id ? '…' : '🗑️'}
                          </IconButton>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot className="bg-rose-50/70 text-sm">
                <tr>
                  <td colSpan={5} className="px-4 py-3 font-bold text-rose-700">মোট ({filtered.length}টি)</td>
                  <td className="px-4 py-3 text-right font-bold text-rose-700 tabular-nums">{BDT(total)}</td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Mobile list */}
          <div className="md:hidden">
            <ExpenseRows items={filtered} onEdit={openEdit} onDelete={remove} deleting={deleting} />
            <div className="flex items-center justify-between bg-rose-50/70 px-4 py-3">
              <span className="text-sm font-bold text-rose-700">মোট ({filtered.length}টি)</span>
              <span className="text-sm font-bold tabular-nums text-rose-700">{BDT(total)}</span>
            </div>
          </div>
        </Card>
      )}

      {/* Sticky mobile add button */}
      <button type="button" onClick={openAdd}
        className="fixed bottom-20 right-4 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500 text-2xl text-white shadow-xl transition active:scale-95 md:hidden"
        aria-label="নতুন খরচ">＋</button>

      {/* ===== Add / Edit modal ===== */}
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={editId ? 'খরচ এডিট করুন' : 'নতুন খরচ যোগ করুন'}
        footer={
          <div className="flex items-center justify-between gap-3">
            <div className="text-sm">
              <span className="text-slate-500">মোট: </span>
              <span className="font-bold text-rose-600 tabular-nums">{BDT(computedAmount)}</span>
            </div>
            <div className="flex gap-2">
              <Button variant="soft" onClick={() => setOpen(false)}>বাতিল</Button>
              <Button variant="primary" onClick={save} disabled={saving}>
                {saving ? 'সেভ হচ্ছে…' : editId ? 'আপডেট করুন' : 'সেভ করুন'}
              </Button>
            </div>
          </div>
        }
      >
        <div className="space-y-5">
          <div>
            <label className={labelCls}>ক্যাটাগরি</label>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {CATEGORIES.map(c => {
                const on = form.category === c.key;
                return (
                  <button key={c.key} type="button" onClick={() => setForm(f => ({ ...f, category: c.key }))}
                    className={cn(
                      'flex items-center gap-2 rounded-xl border px-3 py-2.5 text-left text-xs font-medium transition',
                      on ? 'border-emerald-700 bg-emerald-50 text-emerald-900 ring-2 ring-emerald-600/20' : 'border-slate-200 text-slate-600 hover:border-slate-300'
                    )}>
                    <span className="text-base">{c.icon}</span><span className="leading-tight">{c.key}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className={labelCls}>তারিখ</label>
              <input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>মডেল / প্রোডাক্ট</label>
              <input list="expense-models" value={form.targetModel}
                onChange={e => setForm(f => ({ ...f, targetModel: e.target.value }))}
                placeholder="যেমন: KW83 Max" className={inputCls} />
              <datalist id="expense-models">
                {models.map(m => <option key={m} value={m} />)}
              </datalist>
            </div>
          </div>

          <div>
            <label className={labelCls}>বিবরণ</label>
            <input type="text" value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              placeholder="যেমন: Facebook Ads Dollar Payment" className={inputCls} />
          </div>

          <div className="rounded-2xl border border-violet-100 bg-violet-50/50 p-4">
            <div className="mb-3 flex items-center justify-between">
              <span className="text-xs font-bold text-violet-800">💵 ডলারে পেমেন্ট (ঐচ্ছিক)</span>
              {dollarMode && <Badge tone="violet">অটো হিসাব চালু</Badge>}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>ডলার ($)</label>
                <input type="number" inputMode="decimal" value={form.dollarAmount}
                  onChange={e => setForm(f => ({ ...f, dollarAmount: e.target.value }))} placeholder="0.00" className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>রেট (৳ / $1)</label>
                <input type="number" inputMode="decimal" value={form.dollarRate}
                  onChange={e => setForm(f => ({ ...f, dollarRate: e.target.value }))} placeholder="132" className={inputCls} />
              </div>
            </div>
          </div>

          <div>
            <label className={labelCls}>টাকার পরিমাণ (৳)</label>
            {dollarMode ? (
              <div className="rounded-xl bg-slate-100 px-3 py-2.5 text-sm font-bold tabular-nums text-slate-800">
                {USD(num(form.dollarAmount))} × {form.dollarRate} = {BDT(computedAmount)}
              </div>
            ) : (
              <input type="number" inputMode="decimal" value={form.amount}
                onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} placeholder="0" className={inputCls} />
            )}
          </div>
        </div>
      </Modal>
    </div>
  );
}

// ---- Card-style rows (মোবাইল ভিউ এবং মডেল-গ্রুপ ভিউ দুটোতেই ব্যবহৃত) ----
function ExpenseRows({
  items, onEdit, onDelete, deleting,
}: {
  items: Expense[];
  onEdit: (e: Expense) => void;
  onDelete: (id: string) => void;
  deleting: string | null;
}) {
  return (
    <ul className="divide-y divide-slate-100">
      {items.map(e => {
        const m = catMeta(e.category);
        return (
          <li key={e.id} className="flex items-start gap-3 px-4 py-3">
            <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-base">{m.icon}</span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <span className="text-sm font-semibold text-slate-900">{e.description}</span>
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] text-slate-500">
                <Badge tone={m.tone}>{e.category}</Badge>
                {e.targetModel && <Badge tone="slate">{e.targetModel}</Badge>}
                <span className="tabular-nums">{e.date}</span>
                {e.dollarAmount ? <span className="tabular-nums">· {USD(e.dollarAmount)} @ {e.dollarRate}</span> : null}
              </div>
            </div>
            <div className="flex shrink-0 flex-col items-end gap-1.5">
              <span className="text-sm font-bold tabular-nums text-rose-600">{BDT(e.amount || 0)}</span>
              <div className="flex gap-1">
                <IconButton tone="blue" title="এডিট" onClick={() => onEdit(e)}>✏️</IconButton>
                <IconButton tone="red" title="মুছুন" disabled={deleting === e.id} onClick={() => onDelete(e.id)}>
                  {deleting === e.id ? '…' : '🗑️'}
                </IconButton>
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
