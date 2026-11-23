import { useEffect, useMemo, useState } from 'react';
import { addDoc, collection, deleteDoc, deleteField, doc, onSnapshot, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useBusinessData } from '../hooks/useBusinessData';
import { logActivity } from '../services/activity';
import { adjustStock, RETURNED_STATUSES, resolveItems } from '../services/stock';
import { saleCost } from '../services/accounting';
import type { Payout, Product, Purchase, Sale } from '../types';
import {
  BDT, cn, inputCls, labelCls, Card, PageHeader, StatCard, Badge, Chip, Button, Empty, SkeletonList,
} from '../components/ui';

type Tab = 'purchase' | 'returns' | 'cod';

const todayStr = () => new Date().toISOString().split('T')[0];
const monthNow = () => todayStr().slice(0, 7);
const num = (s: string) => { const v = parseFloat(s); return Number.isFinite(v) ? v : 0; };
const monthOf = (d: string) => (d || '').slice(0, 7);

const STATUS_BN: Record<string, string> = {
  cancelled: 'বাতিল', returned_to_courier: 'কুরিয়ারে ফেরত', returned_to_merchant: 'ফেরত এসেছে',
  partial_returned_to_merchant: 'আংশিক ফেরত',
};

export default function Ledger() {
  const [tab, setTab] = useState<Tab>('purchase');
  const { sales, products, loading } = useBusinessData();
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [payouts, setPayouts] = useState<Payout[]>([]);

  useEffect(() => {
    const u1 = onSnapshot(collection(db, 'purchases'), snap => {
      setPurchases((snap.docs.map(d => ({ id: d.id, ...d.data() })) as Purchase[]).sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0)));
    });
    const u2 = onSnapshot(collection(db, 'payouts'), snap => {
      setPayouts((snap.docs.map(d => ({ id: d.id, ...d.data() })) as Payout[]).sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0)));
    });
    return () => { u1(); u2(); };
  }, []);

  if (loading) return <SkeletonList rows={4} />;

  return (
    <div className="pb-24 sm:pb-8">
      <PageHeader
        theme="sage"
        title="ক্রয়, ফেরত ও COD"
        subtitle="সাপ্লায়ার থেকে কেনা, ফেরত পণ্যের হিসাব, আর Steadfast-এর COD পেমেন্ট মেলানো"
      />
      <div className="mb-4 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none]">
        <Chip active={tab === 'purchase'} onClick={() => setTab('purchase')}>🧾 ক্রয় ও সাপ্লায়ার</Chip>
        <Chip active={tab === 'returns'} onClick={() => setTab('returns')}>↩️ ফেরত পণ্য</Chip>
        <Chip active={tab === 'cod'} onClick={() => setTab('cod')}>💵 COD মেলানো</Chip>
      </div>

      {tab === 'purchase' && <PurchaseTab products={products} purchases={purchases} />}
      {tab === 'returns' && <ReturnsTab sales={sales} products={products} />}
      {tab === 'cod' && <CodTab sales={sales} payouts={payouts} />}
    </div>
  );
}

// ---------- ক্রয় ও সাপ্লায়ার ----------
function PurchaseTab({ products, purchases }: { products: Product[]; purchases: Purchase[] }) {
  const sorted = useMemo(
    () => [...products].sort((a, b) => (a.model || a.name).localeCompare(b.model || b.name)),
    [products]
  );
  const [date, setDate] = useState(todayStr());
  const [supplier, setSupplier] = useState('');
  const [productId, setProductId] = useState('');
  const [color, setColor] = useState('');
  const [qty, setQty] = useState('1');
  const [unitCost, setUnitCost] = useState('');
  const [note, setNote] = useState('');
  const [stockIn, setStockIn] = useState(true);
  const [saving, setSaving] = useState(false);

  const product = products.find(p => p.id === productId);
  const colors = product?.colors || [];

  const pickProduct = (id: string) => {
    setProductId(id);
    const p = products.find(x => x.id === id);
    setColor(p?.colors?.length === 1 ? p.colors[0] : '');
    setUnitCost(p ? String(p.defaultPurchasePrice || '') : '');
  };

  const suppliers = useMemo(
    () => Array.from(new Set(purchases.map(p => p.supplier).filter(Boolean))).sort(),
    [purchases]
  );

  const total = num(qty) * num(unitCost);
  const monthKey = monthNow();
  const thisMonth = purchases.filter(p => monthOf(p.date) === monthKey);
  const monthTotal = thisMonth.reduce((s, p) => s + (p.total || 0), 0);

  const bySupplier = useMemo(() => {
    const m = new Map<string, { count: number; total: number }>();
    purchases.forEach(p => {
      const k = p.supplier || 'অজানা';
      const cur = m.get(k) || { count: 0, total: 0 };
      cur.count += 1;
      cur.total += p.total || 0;
      m.set(k, cur);
    });
    return [...m.entries()].sort((a, b) => b[1].total - a[1].total);
  }, [purchases]);

  const save = async () => {
    if (!product) return alert('প্রোডাক্ট বাছাই করুন');
    const q = Math.max(1, Math.round(num(qty)));
    if (product.colors?.length && !color) return alert('কালার বাছাই করুন');
    setSaving(true);
    try {
      const row: Omit<Purchase, 'id'> = {
        date,
        timestamp: new Date(date).getTime(),
        supplier: supplier.trim() || 'অজানা',
        productId: product.id,
        productName: product.model || product.name,
        color,
        quantity: q,
        unitCost: num(unitCost),
        total: round2(q * num(unitCost)),
        note: note.trim() || undefined,
        stockIn,
      };
      const clean = Object.fromEntries(Object.entries(row).filter(([, v]) => v !== undefined));
      await addDoc(collection(db, 'purchases'), clean);
      if (stockIn) await adjustStock(product.id, color, q);
      void logActivity('product', 'ক্রয় যোগ', `${row.productName} ×${q} · ${row.supplier}`);
      setQty('1');
      setNote('');
    } catch (err) {
      alert('ক্রয় সেভ হয়নি: ' + String(err));
    }
    setSaving(false);
  };

  const remove = async (p: Purchase) => {
    if (!confirm(`${p.productName} ×${p.quantity} (${p.supplier}) ক্রয়ের রেকর্ড মুছবেন?${p.stockIn ? '\nস্টক থেকে এই সংখ্যাটি বাদ যাবে।' : ''}`)) return;
    try {
      if (p.stockIn) await adjustStock(p.productId, p.color, -p.quantity);
      await deleteDoc(doc(db, 'purchases', p.id));
      void logActivity('product', 'ক্রয় মুছা', `${p.productName} ×${p.quantity} · ${p.supplier}`);
    } catch (err) {
      alert('মুছতে সমস্যা: ' + String(err));
    }
  };

  return (
    <div className="grid gap-4 lg:grid-cols-5">
      <div className="space-y-4 lg:col-span-2">
        <Card className="p-4">
          <h2 className="mb-3 text-sm font-bold text-slate-800">নতুন ক্রয়</h2>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>তারিখ</label>
              <input type="date" value={date} onChange={e => setDate(e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>সাপ্লায়ার</label>
              <input list="supplier-list" value={supplier} onChange={e => setSupplier(e.target.value)} placeholder="নাম" className={inputCls} />
              <datalist id="supplier-list">{suppliers.map(s => <option key={s} value={s} />)}</datalist>
            </div>
            <div className="col-span-2">
              <label className={labelCls}>প্রোডাক্ট</label>
              <select value={productId} onChange={e => pickProduct(e.target.value)} className={inputCls}>
                <option value="">— বাছাই করুন —</option>
                {sorted.map(p => <option key={p.id} value={p.id}>{p.model || p.name}{p.category ? ` · ${p.category}` : ''}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>কালার</label>
              {colors.length > 0 ? (
                <select value={color} onChange={e => setColor(e.target.value)} className={inputCls}>
                  <option value="">— বাছাই —</option>
                  {colors.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              ) : (
                <input value={color} onChange={e => setColor(e.target.value)} placeholder="(ঐচ্ছিক)" className={inputCls} />
              )}
            </div>
            <div>
              <label className={labelCls}>সংখ্যা</label>
              <input type="number" min={1} inputMode="numeric" value={qty} onChange={e => setQty(e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>প্রতি পিস দাম (৳)</label>
              <input type="number" inputMode="decimal" value={unitCost} onChange={e => setUnitCost(e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>মোট</label>
              <div className="rounded-xl bg-[#E8F3EE] px-3 py-2.5 text-sm font-bold tabular-nums text-[#14513B]">{BDT(total)}</div>
            </div>
            <div className="col-span-2">
              <label className={labelCls}>নোট</label>
              <input value={note} onChange={e => setNote(e.target.value)} placeholder="চালান নম্বর বা অন্য তথ্য" className={inputCls} />
            </div>
            <label className="col-span-2 flex items-center gap-2 text-sm text-slate-700">
              <input type="checkbox" checked={stockIn} onChange={e => setStockIn(e.target.checked)} className="h-4 w-4 accent-[#14513B]" />
              স্টকে যোগ করুন
            </label>
          </div>
          <div className="mt-4">
            <Button variant="primary" onClick={save} disabled={saving} className="w-full">{saving ? 'সেভ হচ্ছে…' : '＋ ক্রয় সেভ করুন'}</Button>
          </div>
        </Card>

        <Card className="p-4">
          <div className="mb-2 flex items-center justify-between text-sm">
            <span className="font-bold text-slate-800">সাপ্লায়ার অনুযায়ী</span>
            <span className="text-xs text-slate-500">এই মাস: {BDT(monthTotal)} ({thisMonth.length}টি)</span>
          </div>
          {bySupplier.length === 0 ? <div className="py-4 text-center text-xs text-slate-400">এখনো কোনো ক্রয় নেই</div> : (
            <ul className="divide-y divide-slate-100 text-sm">
              {bySupplier.map(([name, v]) => (
                <li key={name} className="flex items-center justify-between py-2">
                  <span className="font-medium text-slate-800">{name} <span className="text-xs text-slate-400">· {v.count}টি</span></span>
                  <span className="font-semibold tabular-nums text-[#14513B]">{BDT(v.total)}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <Card className="overflow-hidden lg:col-span-3">
        <div className="border-b border-slate-100 px-4 py-3">
          <h2 className="text-sm font-bold text-slate-800">সব ক্রয়ের তালিকা</h2>
          <p className="text-[11px] text-slate-500">সর্বশেষ আগে। “স্টকে যোগ” চিহ্নিত ক্রয় মুছলে স্টক থেকেও বাদ যায়।</p>
        </div>
        {purchases.length === 0 ? (
          <Empty icon="🧾" text="এখনো কোনো ক্রয় রেকর্ড নেই" />
        ) : (
          <ul className="max-h-[70vh] divide-y divide-slate-100 overflow-y-auto">
            {purchases.slice(0, 200).map(p => (
              <li key={p.id} className="flex items-start justify-between gap-3 px-4 py-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-sm font-semibold text-slate-900">{p.productName}{p.color ? ` (${p.color})` : ''}</span>
                    <span className="text-xs text-slate-500">×{p.quantity}</span>
                    {p.stockIn ? <Badge tone="green">স্টকে যোগ</Badge> : <Badge tone="slate">শুধু রেকর্ড</Badge>}
                  </div>
                  <div className="mt-0.5 text-xs text-slate-500">{p.date} · {p.supplier}{p.note ? ` · ${p.note}` : ''}</div>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <span className="text-sm font-bold tabular-nums text-slate-900">{BDT(p.total || 0)}</span>
                  <button type="button" onClick={() => remove(p)} aria-label="মুছুন"
                    className="flex h-8 w-8 items-center justify-center rounded-lg bg-rose-50 text-sm text-rose-600 hover:bg-rose-100">🗑️</button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

const round2 = (n: number) => Math.round(n * 100) / 100;

// ---------- ফেরত পণ্য ----------
function ReturnsTab({ sales, products }: { sales: Sale[]; products: Product[] }) {
  const [busyId, setBusyId] = useState<string | null>(null);
  const returned = useMemo(
    () => sales.filter(s => s.saleType === 'Courier Sale' && RETURNED_STATUSES.includes(s.courierDeliveryStatus || '')),
    [sales]
  );

  const totals = useMemo(() => {
    const goods = returned.reduce((t, s) => t + saleCost(s), 0);
    const resell = returned.filter(s => s.returnCondition === 'resellable').length;
    const damaged = returned.filter(s => s.returnCondition === 'damaged');
    return {
      count: returned.length,
      value: returned.reduce((t, s) => t + (s.salesAmount || 0), 0),
      goods,
      resell,
      damaged: damaged.length,
      damagedCost: damaged.reduce((t, s) => t + saleCost(s), 0),
    };
  }, [returned]);

  // অবস্থা বদল: নষ্ট হলে স্টক থেকে একবার বাদ, আবার বিক্রয়যোগ্য হলে ফেরত যোগ
  const setCondition = async (s: Sale, next: 'resellable' | 'damaged' | '') => {
    setBusyId(s.id);
    try {
      let written = !!s.returnWrittenOff;
      // শুধু নতুন ডেটায় (stockAdjusted = false মানে ফেরতে স্টক ফিরেছে) স্টক বদলায়
      if (s.stockAdjusted === false) {
        const lines = resolveItems(s.items || [], products);
        if (next === 'damaged' && !written) {
          for (const l of lines) await adjustStock(l.productId, l.color || '', -l.quantity);
          written = true;
        } else if (next === 'resellable' && written) {
          for (const l of lines) await adjustStock(l.productId, l.color || '', l.quantity);
          written = false;
        }
      }
      await updateDoc(doc(db, 'sales', s.id), {
        returnCondition: next || deleteField(),
        returnWrittenOff: written,
      });
      void logActivity('sale', 'ফেরত পণ্য', `${s.invoice || ''} → ${next === 'damaged' ? 'নষ্ট' : next === 'resellable' ? 'বিক্রয়যোগ্য' : 'বাছাই হয়নি'}`);
    } catch (err) {
      alert('অবস্থা সেভ হয়নি: ' + String(err));
    }
    setBusyId(null);
  };

  if (returned.length === 0) {
    return <Card><Empty icon="↩️" text="কোনো ফেরত বা বাতিল কুরিয়ার সেল নেই" /></Card>;
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="ফেরত / বাতিল" value={`${totals.count}টি`} sub={`বিল ${BDT(totals.value)}`} tone="red" icon="↩️" />
        <StatCard label="পণ্যের ক্রয়মূল্য" value={BDT(totals.goods)} sub="ফেরত আসা পণ্যের মূল্য" tone="amber" icon="📦" />
        <StatCard label="বিক্রয়যোগ্য" value={`${totals.resell}টি`} sub="আবার স্টকে তোলা যাবে" tone="green" icon="✅" />
        <StatCard label="নষ্ট" value={`${totals.damaged}টি`} sub={`ক্ষতি ${BDT(totals.damagedCost)}`} tone="violet" icon="🗑️" />
      </div>

      <Card className="overflow-hidden">
        <div className="border-b border-slate-100 px-4 py-3">
          <p className="text-xs text-slate-600">
            ফেরত এলে পণ্য আগেই স্টকে ফেরত ধরা হয়। পণ্য নষ্ট হলে <b>“নষ্ট”</b> বাছাই করুন, তখন স্টক থেকে বাদ যাবে।
            আবার ভালো হলে <b>“বিক্রয়যোগ্য”</b>-তে ফেরান।
          </p>
        </div>
        <ul className="divide-y divide-slate-100">
          {returned.map(s => (
            <li key={s.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-xs font-semibold text-emerald-900">{s.invoice || s.id.slice(0, 8).toUpperCase()}</span>
                  <Badge tone="red">{STATUS_BN[s.courierDeliveryStatus || ''] || s.courierDeliveryStatus}</Badge>
                  <span className="text-xs text-slate-400">{s.date}</span>
                </div>
                <div className="mt-0.5 truncate text-sm font-medium text-slate-900">{s.customerRef || 'কাস্টমার'} <span className="text-xs font-normal text-slate-500">{s.customerPhone || ''}</span></div>
                <div className="truncate text-xs text-slate-500">{s.items?.length ? s.items.map(i => i.model || i.productName).join(', ') : s.model}</div>
              </div>
              <div className="flex items-center gap-3">
                <div className="text-right text-xs tabular-nums">
                  <div className="font-semibold text-slate-800">{BDT(s.salesAmount || 0)}</div>
                  <div className="text-slate-500">ক্রয় {BDT(saleCost(s))}</div>
                </div>
                <select
                  value={s.returnCondition || ''}
                  disabled={busyId === s.id}
                  onChange={e => setCondition(s, e.target.value as 'resellable' | 'damaged' | '')}
                  className={cn(
                    'rounded-lg border-0 px-2.5 py-1.5 text-xs font-semibold ring-1 disabled:opacity-50',
                    s.returnCondition === 'resellable' && 'bg-emerald-50 text-emerald-700 ring-emerald-200',
                    s.returnCondition === 'damaged' && 'bg-rose-50 text-rose-700 ring-rose-200',
                    !s.returnCondition && 'bg-slate-100 text-slate-700 ring-slate-200'
                  )}
                >
                  <option value="">অবস্থা: বাছাই হয়নি</option>
                  <option value="resellable">বিক্রয়যোগ্য</option>
                  <option value="damaged">নষ্ট</option>
                </select>
              </div>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}

// ---------- COD মেলানো ----------
// হিসাব: ডেলিভারি হওয়া COD − কুরিয়ার চার্জ − COD কন্ডিশন চার্জ = আনুমানিক প্রাপ্য।
// সেলের তারিখ ধরে মাস নির্ধারণ; পেমেন্ট যে মাসে এসেছে সেটা পেমেন্ট তারিখে।
function CodTab({ sales, payouts }: { sales: Sale[]; payouts: Payout[] }) {
  const [month, setMonth] = useState(monthNow());
  const [date, setDate] = useState(todayStr());
  const [amount, setAmount] = useState('');
  const [reference, setReference] = useState('');
  const [saving, setSaving] = useState(false);

  const monthSales = useMemo(
    () => sales.filter(s => s.saleType === 'Courier Sale' && monthOf(s.date) === month),
    [sales, month]
  );
  const delivered = monthSales.filter(s => s.courierDeliveryStatus === 'delivered');
  const codDelivered = delivered.reduce((t, s) => t + (s.codAmount || 0), 0);
  const charges = delivered.reduce((t, s) => t + (s.courierCharge || 0) + (s.courierConditionCost || 0), 0);
  const expected = Math.max(0, codDelivered - charges);
  const openCod = monthSales
    .filter(s => !['delivered', 'cancelled', 'returned_to_courier', 'returned_to_merchant', 'partial_returned_to_merchant'].includes(s.courierDeliveryStatus || ''))
    .reduce((t, s) => t + (s.codAmount || 0), 0);

  const monthPayouts = payouts.filter(p => monthOf(p.date) === month);
  const received = monthPayouts.reduce((t, p) => t + (p.amount || 0), 0);
  const diff = received - expected;

  const save = async () => {
    const amt = num(amount);
    if (amt <= 0) return alert('কত টাকা পেয়েছেন লিখুন');
    setSaving(true);
    try {
      await addDoc(collection(db, 'payouts'), {
        date,
        timestamp: new Date(date).getTime(),
        amount: amt,
        reference: reference.trim() || undefined,
      });
      void logActivity('sale', 'COD পেমেন্ট', `${BDT(amt)} · ${date}`);
      setAmount('');
      setReference('');
    } catch (err) {
      alert('সেভ হয়নি: ' + String(err));
    }
    setSaving(false);
  };

  const remove = async (p: Payout) => {
    if (!confirm(`${BDT(p.amount)} পেমেন্টের রেকর্ড মুছবেন?`)) return;
    try {
      await deleteDoc(doc(db, 'payouts', p.id));
    } catch (err) {
      alert('মুছতে সমস্যা: ' + String(err));
    }
  };

  return (
    <div className="space-y-4">
      <Card className="flex flex-wrap items-center justify-between gap-3 p-4">
        <div>
          <div className="text-sm font-bold text-slate-800">মাস বাছাই</div>
          <div className="text-xs text-slate-500">সেলের তারিখ ধরে হিসাব</div>
        </div>
        <input type="month" value={month} onChange={e => setMonth(e.target.value)} className="rounded-lg border border-slate-200 px-3 py-2 text-sm" />
      </Card>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="ডেলিভারি COD" value={BDT(codDelivered)} sub={`${delivered.length}টি সেল`} tone="blue" icon="🏍️" />
        <StatCard label="আনুমানিক প্রাপ্য" value={BDT(expected)} sub="COD − কুরিয়ার ও কন্ডিশন চার্জ" tone="green" icon="🧮" />
        <StatCard label="পেয়েছেন" value={BDT(received)} sub={`${monthPayouts.length}টি পেমেন্ট`} tone="violet" icon="💵" />
        <StatCard label={diff === 0 ? 'মিলেছে' : diff > 0 ? 'বেশি এসেছে' : 'কম এসেছে'} value={BDT(Math.abs(diff))}
          sub={`এখনো কুরিয়ারে বাকি COD ${BDT(openCod)}`} tone={diff < 0 ? 'red' : 'green'} icon={diff === 0 ? '✅' : '⚖️'} />
      </div>

      <div className="grid gap-4 lg:grid-cols-5">
        <Card className="p-4 lg:col-span-2">
          <h2 className="mb-3 text-sm font-bold text-slate-800">নতুন পেমেন্ট যোগ</h2>
          <div className="space-y-3">
            <div>
              <label className={labelCls}>তারিখ</label>
              <input type="date" value={date} onChange={e => setDate(e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>টাকার পরিমাণ (৳)</label>
              <input type="number" inputMode="decimal" value={amount} onChange={e => setAmount(e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>রেফারেন্স (ঐচ্ছিক)</label>
              <input value={reference} onChange={e => setReference(e.target.value)} placeholder="Steadfast পেমেন্ট আইডি" className={inputCls} />
            </div>
            <Button variant="primary" onClick={save} disabled={saving} className="w-full">{saving ? 'সেভ হচ্ছে…' : '＋ পেমেন্ট সেভ'}</Button>
            <p className="text-[11px] text-slate-500">
              Steadfast-এর ব্যালেন্স বা পেমেন্ট রিপোর্ট থেকে যে টাকা এসেছে সেটা লিখুন। অ্যাপ নিজে থেকে টাকা আনে না।
            </p>
          </div>
        </Card>

        <Card className="overflow-hidden lg:col-span-3">
          <div className="border-b border-slate-100 px-4 py-3">
            <h2 className="text-sm font-bold text-slate-800">এই মাসের পেমেন্ট</h2>
          </div>
          {monthPayouts.length === 0 ? (
            <Empty icon="💵" text="এই মাসে কোনো পেমেন্ট রেকর্ড নেই" />
          ) : (
            <ul className="divide-y divide-slate-100">
              {monthPayouts.map(p => (
                <li key={p.id} className="flex items-center justify-between gap-3 px-4 py-3">
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-slate-900">{BDT(p.amount)}</div>
                    <div className="text-xs text-slate-500">{p.date}{p.reference ? ` · ${p.reference}` : ''}</div>
                  </div>
                  <button type="button" onClick={() => remove(p)} aria-label="মুছুন"
                    className="flex h-8 w-8 items-center justify-center rounded-lg bg-rose-50 text-sm text-rose-600 hover:bg-rose-100">🗑️</button>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
