import { useEffect, useMemo, useState } from 'react';
import { collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc } from 'firebase/firestore';
import { db } from '../firebase';
import { logActivity } from '../services/activity';
import type { Product } from '../types';
import { stockStatus } from '../services/stock';
import {
  BDT, cn, inputCls, labelCls, Card, PageHeader, StatCard, Badge, Chip, Button,
  IconButton, Modal, Empty, SkeletonList,
} from '../components/ui';

// ---------- helpers ----------
const num = (s: string) => { const v = parseFloat(s); return Number.isFinite(v) ? v : 0; };

/** "Black:10, White:5" → { Black: 10, White: 5 } */
function parseColorStock(raw: string): Record<string, number> {
  const out: Record<string, number> = {};
  raw.split(',').forEach(part => {
    const [color, qty] = part.split(':').map(s => s?.trim());
    if (!color || qty === undefined) return;
    const n = parseInt(qty, 10);
    if (!Number.isNaN(n) && n >= 0) out[color] = n;
  });
  return out;
}

const stockTone = (st: string) =>
  st === 'OUT OF STOCK' ? 'red' : st === 'LOW STOCK' ? 'amber' : 'green';

type ProductForm = {
  name: string;
  model: string;
  category: string;
  defaultPurchasePrice: string;
  defaultSellingPrice: string;
  currentStock: string;
  colorStockRaw: string;
};

const emptyForm = (): ProductForm => ({
  name: '', model: '', category: '', defaultPurchasePrice: '', defaultSellingPrice: '', currentStock: '', colorStockRaw: '',
});

function productToForm(p: Product): ProductForm {
  return {
    name: p.name || '',
    model: p.model || '',
    category: p.category || '',
    defaultPurchasePrice: String(p.defaultPurchasePrice || ''),
    defaultSellingPrice: String(p.defaultSellingPrice || ''),
    currentStock: String(p.currentStock ?? ''),
    colorStockRaw: p.colorStock
      ? Object.entries(p.colorStock).map(([c, q]) => `${c}:${q}`).join(', ')
      : '',
  };
}

export default function Products() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [stockFilter, setStockFilter] = useState<'' | 'low' | 'out'>('');

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [form, setForm] = useState<ProductForm>(emptyForm());
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  // লাইভ ডেটা — বিক্রি বা স্টক বদলালে (সেলস, কুরিয়ার সিঙ্ক) সাথে সাথে সংখ্যা আপডেট হয়
  useEffect(() => {
    return onSnapshot(collection(db, 'products'), snap => {
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() })) as Product[];
      data.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
      setProducts(data);
      setLoading(false);
    });
  }, []);

  const categories = useMemo(
    () => Array.from(new Set(products.map(p => p.category).filter(Boolean))).sort(),
    [products]
  );

  const filtered = useMemo(() => products.filter(p => {
    const q = search.toLowerCase();
    if (q && !`${p.name} ${p.model} ${p.category}`.toLowerCase().includes(q)) return false;
    if (category && p.category !== category) return false;
    if (stockFilter === 'low' && !(p.currentStock > 0 && p.currentStock <= 5)) return false;
    if (stockFilter === 'out' && (p.currentStock || 0) > 0) return false;
    return true;
  }), [products, search, category, stockFilter]);

  const totals = useMemo(() => ({
    stock: products.reduce((s, p) => s + (p.currentStock || 0), 0),
    value: products.reduce((s, p) => s + (p.stockValue || 0), 0),
    sold: products.reduce((s, p) => s + (p.totalSold || 0), 0),
    low: products.filter(p => p.currentStock > 0 && p.currentStock <= 5).length,
    out: products.filter(p => (p.currentStock || 0) <= 0).length,
  }), [products]);

  // ---------- form ----------
  const set = <K extends keyof ProductForm>(k: K, v: ProductForm[K]) => setForm(f => ({ ...f, [k]: v }));
  const colorMap = parseColorStock(form.colorStockRaw);
  const colorSum = Object.values(colorMap).reduce((s, n) => s + n, 0);
  const hasColors = Object.keys(colorMap).length > 0;
  const previewStock = hasColors ? colorSum : num(form.currentStock);
  const previewValue = previewStock * num(form.defaultSellingPrice);

  const openAdd = () => { setEditing(null); setForm(emptyForm()); setOpen(true); };
  const openEdit = (p: Product) => { setEditing(p); setForm(productToForm(p)); setOpen(true); };

  const save = async () => {
    if (!form.name.trim()) return alert('প্রোডাক্টের নাম দিন');
    setSaving(true);
    const colorStock = parseColorStock(form.colorStockRaw);
    const stock = Object.keys(colorStock).length > 0
      ? Object.values(colorStock).reduce((s, n) => s + n, 0)
      : Math.max(0, parseInt(form.currentStock, 10) || 0);
    const sellingPrice = num(form.defaultSellingPrice);

    const payload: Record<string, unknown> = {
      name: form.name.trim(),
      model: form.model.trim(),
      category: form.category.trim(),
      colors: Object.keys(colorStock),
      colorStock,
      currentStock: stock,
      defaultPurchasePrice: num(form.defaultPurchasePrice),
      defaultSellingPrice: sellingPrice,
      stockValue: sellingPrice * stock,
      status: stockStatus(stock),
    };

    try {
      if (editing) {
        // বিক্রির ইতিহাস ধরে রাখি — শুধু স্টক/দাম এডিট হয়
        payload.colorSold = editing.colorSold || {};
        payload.totalSold = editing.totalSold || 0;
        payload.openingStock = editing.openingStock ?? stock;
        payload.colorOpeningStock = editing.colorOpeningStock || colorStock;
        await updateDoc(doc(db, 'products', editing.id), payload);
      } else {
        await addDoc(collection(db, 'products'), {
          ...payload,
          colorSold: {},
          colorOpeningStock: colorStock,
          totalSold: 0,
          openingStock: stock,
        });
      }
      void logActivity('product', editing ? 'প্রোডাক্ট এডিট' : 'প্রোডাক্ট যোগ', form.name.trim());
      setOpen(false);
    } catch (err) {
      alert('সেভ করতে সমস্যা: ' + String(err));
    }
    setSaving(false);
  };

  const remove = async (p: Product) => {
    if (!confirm(`"${p.name}" মুছে ফেলবেন? বিক্রির রেকর্ড থাকবে, কিন্তু প্রোডাক্টটি আর দেখাবে না।`)) return;
    setDeleting(p.id);
    try {
      await deleteDoc(doc(db, 'products', p.id));
      void logActivity('product', 'প্রোডাক্ট মুছা', p.name);
    } catch (err) {
      alert('মুছতে সমস্যা: ' + String(err));
    }
    setDeleting(null);
  };

  if (loading) return <SkeletonList rows={5} />;

  return (
    <div className="pb-24 sm:pb-8">
      <PageHeader
        theme="lime"
        title="প্রোডাক্ট ও স্টক"
        subtitle="কালারভিত্তিক স্টক, দাম ও বিক্রির হিসাব — বিক্রি হলে স্টক নিজে কমে"
        actions={<Button variant="accent" onClick={openAdd} className="w-full sm:w-auto">＋ নতুন প্রোডাক্ট</Button>}
      />

      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="মোট স্টক" value={`${totals.stock.toLocaleString('en-IN')} পিস`} sub={`${products.length}টি প্রোডাক্ট`} tone="blue" icon="📦" />
        <StatCard label="স্টক ভ্যালু" value={BDT(totals.value)} sub="বিক্রয় মূল্যে" tone="green" icon="💎" />
        <StatCard label="মোট বিক্রি" value={`${totals.sold.toLocaleString('en-IN')} পিস`} sub="শুরু থেকে" tone="violet" icon="🛒" />
        <StatCard label="সতর্কতা" value={`${totals.out} আউট · ${totals.low} কম`} sub="স্টক শেষ / ৫ বা কম" tone={totals.out ? 'red' : 'amber'} icon="⚠️" />
      </div>

      <Card className="mb-4 p-3 sm:p-4">
        <div className="flex flex-wrap items-center gap-2">
          <Chip active={!category} onClick={() => setCategory('')}>সব ক্যাটাগরি</Chip>
          {categories.map(c => (
            <Chip key={c} active={category === c} onClick={() => setCategory(category === c ? '' : c)}>{c}</Chip>
          ))}
          <span className="mx-1 hidden h-5 w-px bg-slate-200 sm:block" />
          <Chip active={stockFilter === 'low'} onClick={() => setStockFilter(stockFilter === 'low' ? '' : 'low')}>কম স্টক</Chip>
          <Chip active={stockFilter === 'out'} tone="red" onClick={() => setStockFilter(stockFilter === 'out' ? '' : 'out')}>স্টক শেষ</Chip>
        </div>
        <input type="search" value={search} onChange={e => setSearch(e.target.value)}
          placeholder="খুঁজুন — নাম, মডেল, ক্যাটাগরি..." className={cn(inputCls, 'mt-3')} />
      </Card>

      {filtered.length === 0 ? (
        <Card><Empty icon="📦" text="কোনো প্রোডাক্ট নেই" action={<Button variant="primary" onClick={openAdd}>＋ প্রোডাক্ট যোগ করুন</Button>} /></Card>
      ) : (
        <>
          {/* Desktop table */}
          <Card className="hidden overflow-hidden xl:block">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs font-semibold text-slate-500">
                <tr>
                  <th className="px-4 py-3">প্রোডাক্ট</th>
                  <th className="px-4 py-3">কালার স্টক</th>
                  <th className="px-4 py-3 text-right">স্টক</th>
                  <th className="px-4 py-3 text-right">বিক্রি</th>
                  <th className="px-4 py-3 text-right">ক্রয় / বিক্রয়</th>
                  <th className="px-4 py-3 text-right">স্টক ভ্যালু</th>
                  <th className="px-4 py-3">স্ট্যাটাস</th>
                  <th className="px-4 py-3 text-center">অ্যাকশন</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map(p => {
                  const st = p.status || stockStatus(p.currentStock || 0);
                  return (
                    <tr key={p.id} className="align-top hover:bg-slate-50/70">
                      <td className="px-4 py-3">
                        <div className="font-semibold text-slate-900">{p.name}</div>
                        <div className="text-xs text-slate-500">{p.model}{p.category ? ` · ${p.category}` : ''}</div>
                      </td>
                      <td className="px-4 py-3"><ColorChips p={p} /></td>
                      <td className="px-4 py-3 text-right font-bold tabular-nums">{p.currentStock ?? 0}</td>
                      <td className="px-4 py-3 text-right tabular-nums text-violet-700">{p.totalSold ?? 0}</td>
                      <td className="px-4 py-3 text-right text-xs tabular-nums">
                        <div className="text-slate-500">{BDT(p.defaultPurchasePrice || 0)}</div>
                        <div className="font-semibold text-slate-900">{BDT(p.defaultSellingPrice || 0)}</div>
                      </td>
                      <td className="px-4 py-3 text-right font-bold tabular-nums text-emerald-700">{BDT(p.stockValue || 0)}</td>
                      <td className="px-4 py-3"><Badge tone={stockTone(st)}>{st}</Badge></td>
                      <td className="px-4 py-3">
                        <div className="flex justify-center gap-1.5">
                          <IconButton tone="blue" title="এডিট" onClick={() => openEdit(p)}>✏️</IconButton>
                          <IconButton tone="red" title="মুছুন" disabled={deleting === p.id} onClick={() => remove(p)}>
                            {deleting === p.id ? '…' : '🗑️'}
                          </IconButton>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </Card>

          {/* Mobile & tablet cards */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:hidden">
            {filtered.map(p => {
              const st = p.status || stockStatus(p.currentStock || 0);
              const margin = (p.defaultSellingPrice || 0) - (p.defaultPurchasePrice || 0);
              return (
                <Card key={p.id} className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate font-bold text-slate-900">{p.name}</div>
                      <div className="truncate text-xs text-slate-500">{p.model}{p.category ? ` · ${p.category}` : ''}</div>
                    </div>
                    <Badge tone={stockTone(st)}>{st}</Badge>
                  </div>

                  <div className="mt-3 grid grid-cols-3 gap-2 rounded-xl bg-slate-50 p-3 text-center">
                    <div><div className="text-xs text-slate-500">স্টক</div><div className="text-base font-bold tabular-nums">{p.currentStock ?? 0}</div></div>
                    <div><div className="text-xs text-slate-500">বিক্রি</div><div className="text-base font-bold tabular-nums text-violet-700">{p.totalSold ?? 0}</div></div>
                    <div><div className="text-xs text-slate-500">লাভ/পিস</div><div className={cn('text-base font-bold tabular-nums', margin >= 0 ? 'text-emerald-700' : 'text-rose-600')}>{BDT(margin)}</div></div>
                  </div>

                  <div className="mt-3"><ColorChips p={p} /></div>

                  <div className="mt-3 flex items-center justify-between">
                    <div className="text-xs text-slate-500">
                      ক্রয় {BDT(p.defaultPurchasePrice || 0)} · বিক্রয় {BDT(p.defaultSellingPrice || 0)}
                    </div>
                    <div className="flex gap-1.5">
                      <IconButton tone="blue" title="এডিট" onClick={() => openEdit(p)}>✏️</IconButton>
                      <IconButton tone="red" title="মুছুন" disabled={deleting === p.id} onClick={() => remove(p)}>
                        {deleting === p.id ? '…' : '🗑️'}
                      </IconButton>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        </>
      )}

      <button type="button" onClick={openAdd}
        className="fixed bottom-20 right-4 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-[#1A8A62] text-2xl text-white shadow-xl transition active:scale-95 lg:hidden"
        aria-label="নতুন প্রোডাক্ট">＋</button>

      {/* ===== Add / Edit ===== */}
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={editing ? 'প্রোডাক্ট এডিট করুন' : 'নতুন প্রোডাক্ট'}
        footer={
          <div className="flex items-center justify-between gap-3">
            <div className="text-xs">
              <span className="text-slate-500">স্টক: </span><span className="font-bold">{previewStock}</span>
              <span className="ml-3 text-slate-500">ভ্যালু: </span><span className="font-bold text-emerald-700 tabular-nums">{BDT(previewValue)}</span>
            </div>
            <div className="flex gap-2">
              <Button variant="soft" onClick={() => setOpen(false)}>বাতিল</Button>
              <Button variant="primary" onClick={save} disabled={saving}>{saving ? 'সেভ হচ্ছে…' : editing ? 'আপডেট' : 'সেভ করুন'}</Button>
            </div>
          </div>
        }
      >
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className={labelCls}>প্রোডাক্টের নাম *</label>
              <input value={form.name} onChange={e => set('name', e.target.value)} placeholder="যেমন: Smart Watch" className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>মডেল</label>
              <input value={form.model} onChange={e => set('model', e.target.value)} placeholder="যেমন: KW83 Max" className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>ক্যাটাগরি</label>
              <input list="product-cats" value={form.category} onChange={e => set('category', e.target.value)} placeholder="Smart Watch" className={inputCls} />
              <datalist id="product-cats">{categories.map(c => <option key={c} value={c} />)}</datalist>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>ক্রয় দর (৳)</label>
                <input type="number" inputMode="decimal" value={form.defaultPurchasePrice} onChange={e => set('defaultPurchasePrice', e.target.value)} className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>বিক্রয় দর (৳)</label>
                <input type="number" inputMode="decimal" value={form.defaultSellingPrice} onChange={e => set('defaultSellingPrice', e.target.value)} className={inputCls} />
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-[#CFE6DA] bg-[#F3FAF6] p-4">
            <div className="mb-3 text-xs font-bold text-emerald-900">🎨 কালার ও স্টক</div>
            <label className={labelCls}>কালার:পরিমাণ (কমা দিয়ে আলাদা করুন)</label>
            <input value={form.colorStockRaw} onChange={e => set('colorStockRaw', e.target.value)}
              placeholder="Black:10, Silver:5, Gold:3" className={inputCls} />
            {!hasColors && (
              <div className="mt-3">
                <label className={labelCls}>মোট স্টক (কালার ছাড়া)</label>
                <input type="number" inputMode="numeric" value={form.currentStock} onChange={e => set('currentStock', e.target.value)} className={inputCls} />
              </div>
            )}
            {hasColors && (
              <div className="mt-3 flex flex-wrap gap-2">
                {Object.entries(colorMap).map(([c, q]) => (
                  <span key={c} className="rounded-full bg-white px-3 py-1 text-xs font-medium text-slate-700 ring-1 ring-emerald-200">
                    {c} <b className="text-emerald-800">{q}</b>
                  </span>
                ))}
              </div>
            )}
            <p className="mt-2 text-xs text-slate-500">কালার দিলে মোট স্টক নিজে থেকে যোগফল হবে। বিক্রি হলে সংশ্লিষ্ট কালার থেকে স্টক কমবে।</p>
          </div>
        </div>
      </Modal>
    </div>
  );
}

function ColorChips({ p }: { p: Product }) {
  const entries = Object.entries(p.colorStock || {});
  if (!entries.length) return <span className="text-xs text-slate-300">কালার নেই</span>;
  return (
    <div className="flex flex-wrap gap-1.5">
      {entries.map(([c, q]) => {
        const sold = p.colorSold?.[c] || 0;
        return (
          <span key={c} className={cn(
            'inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs ring-1',
            q <= 0 ? 'bg-rose-50 text-rose-700 ring-rose-200' : q <= 5 ? 'bg-amber-50 text-amber-800 ring-amber-200' : 'bg-white text-slate-700 ring-slate-200'
          )}>
            {c} <b className="tabular-nums">{q}</b>
            {sold > 0 && <span className="text-violet-600">· বিক্রি {sold}</span>}
          </span>
        );
      })}
    </div>
  );
}
