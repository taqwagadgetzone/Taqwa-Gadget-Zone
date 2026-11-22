import { useEffect, useMemo, useRef, useState } from 'react';
import { collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc } from 'firebase/firestore';
import { db } from '../firebase';
import type { Sale, Product } from '../types';
import { createParcel, getBalance } from '../services/steadfast';
import { applyStock, resolveItems, shouldDeduct } from '../services/stock';
import { fetchCourierStatus, isTrackable, saveCourierStatus, syncCourierStatuses } from '../services/courierSync';
import { summarize } from '../services/accounting';
import {
  BDT, cn, inputCls, labelCls, Card, PageHeader, StatCard, Badge, Chip, Button,
  IconButton, Modal, Empty, Spinner,
} from '../components/ui';

// ---------- constants ----------
const STATUS_CONFIG: Record<string, { label: string; tone: 'amber' | 'blue' | 'red' | 'green' | 'violet' | 'slate' }> = {
  in_review:                  { label: 'রিভিউতে',            tone: 'blue' },
  pending:                    { label: 'পেন্ডিং',            tone: 'amber' },
  delivered_approval_pending: { label: 'ডেলিভারি অপেক্ষায়', tone: 'amber' },
  partial_delivered:          { label: 'আংশিক ডেলিভারি',     tone: 'violet' },
  delivered:                  { label: 'ডেলিভারি হয়েছে',    tone: 'green' },
  cancelled:                  { label: 'বাতিল',              tone: 'red' },
  hold:                       { label: 'হোল্ড',              tone: 'slate' },
  processing:                 { label: 'প্রসেসিং',           tone: 'blue' },
  picked_up:                  { label: 'পিকআপ হয়েছে',       tone: 'blue' },
  in_transit:                 { label: 'পথে আছে',            tone: 'violet' },
  returned_to_courier:        { label: 'কুরিয়ারে ফেরত',     tone: 'red' },
  returned_to_merchant:       { label: 'ফেরত এসেছে',         tone: 'red' },
  partial_returned_to_merchant: { label: 'আংশিক ফেরত',       tone: 'red' },
  unknown:                    { label: 'অজানা',              tone: 'slate' },
};

const CHANNELS = ['Facebook', 'TikTok'];
const DELIVERY_CHIPS = [0, 60, 100, 115, 130, 150];
const ADVANCE_CHIPS = [100, 115, 150, 200, 500];
const PAYMENT_METHODS = ['bKash', 'Nagad', 'Rocket', 'Cash', 'Bank'];
const COD_CONDITION_RATE = 0.01; // COD-এর ১% কন্ডিশন চার্জ
const RIDER_NOTE_DEFAULT = 'নির্দেশনা: কাস্টমার চেক করতে চাইলে সামনে রেখে আনবক্সিং ভিডিও করুন। প্রয়োজনে মার্চেন্টে কল দিন।';

// ---------- helpers ----------
const todayStr = () => new Date().toISOString().split('T')[0];
const monthNow = () => todayStr().slice(0, 7);
const num = (s: string) => { const v = parseFloat(s); return Number.isFinite(v) ? v : 0; };
const round2 = (n: number) => Math.round(n * 100) / 100;
const cleanObj = <T extends Record<string, unknown>>(o: T) =>
  Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as T;
const isPhone = (p: string) => /^01\d{9}$/.test(p.replace(/\s|-/g, ''));

type Line = { id: string; category: string; model: string; color: string; qty: string; purchase: string; selling: string };

type SaleForm = {
  date: string;
  saleType: 'Courier Sale' | 'Direct Sale';
  channel: string;
  customerRef: string;
  phone: string;
  address: string;
  district: string;
  invoice: string;
  courierInvoice: string;
  lines: Line[];
  courierCharge: string;
  advance: string;
  paymentMethod: string;
  trxId: string;
  otherCost: string;
  deliveryNote: string;
  bookSteadfast: boolean;
  courierTrackingCode: string;
  status: string;
};

const newLine = (): Line => ({ id: crypto.randomUUID(), category: '', model: '', color: '', qty: '1', purchase: '', selling: '' });

// ফোন নম্বর থেকে সবচেয়ে নতুন আগের কাস্টমার খোঁজার জন্য — শুধু ডিজিট মিলিয়ে
const digitsOnly = (p: string) => p.replace(/\D/g, '');

const emptyForm = (invoice: string): SaleForm => ({
  date: todayStr(),
  saleType: 'Courier Sale',
  channel: 'Facebook',
  customerRef: '',
  phone: '',
  address: '',
  district: '',
  invoice,
  courierInvoice: '',
  lines: [newLine()],
  courierCharge: '115',
  advance: '0',
  paymentMethod: '',
  trxId: '',
  otherCost: '0',
  deliveryNote: RIDER_NOTE_DEFAULT,
  bookSteadfast: true,
  courierTrackingCode: '',
  status: 'pending',
});

// হিসাবের একটাই জায়গা — ফর্ম প্রিভিউ ও সেভ দুটোই এখান থেকে
function calc(f: SaleForm) {
  const lines = f.lines.map(l => {
    const qty = Math.max(1, parseInt(l.qty) || 1);
    const purchase = num(l.purchase);
    const selling = num(l.selling);
    return { ...l, qty, purchase, selling, totalPurchase: qty * purchase, totalSelling: qty * selling };
  });
  const isCourier = f.saleType === 'Courier Sale';
  const qtyTotal = lines.reduce((s, l) => s + l.qty, 0);
  const productTotal = lines.reduce((s, l) => s + l.totalSelling, 0);
  const purchaseTotal = lines.reduce((s, l) => s + l.totalPurchase, 0);
  const courierCharge = isCourier ? num(f.courierCharge) : 0;
  const bill = productTotal + courierCharge;
  const advance = Math.min(num(f.advance), bill);
  const cod = isCourier ? Math.max(0, bill - advance) : 0;
  const condition = isCourier ? round2(cod * COD_CONDITION_RATE) : 0;
  const otherCost = num(f.otherCost);
  const profit = round2(bill - purchaseTotal - courierCharge - condition - otherCost);
  return { lines, isCourier, qtyTotal, productTotal, purchaseTotal, courierCharge, bill, advance, cod, condition, otherCost, profit };
}

export default function Sales() {
  const [sales, setSales] = useState<Sale[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [balance, setBalance] = useState<number | null>(null);

  // filters
  const [period, setPeriod] = useState<'today' | 'month' | 'all'>('month');
  const [monthKey, setMonthKey] = useState(monthNow());
  const [channelFilter, setChannelFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch] = useState('');

  // modal
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [editingSale, setEditingSale] = useState<Sale | null>(null);
  const [form, setForm] = useState<SaleForm>(emptyForm(''));
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [autoFilled, setAutoFilled] = useState(false);

  // লাইভ ডেটা — সেল বা প্রোডাক্ট বদলালে (সেভ, স্ট্যাটাস, কুরিয়ার সিঙ্ক) সাথে সাথে স্ক্রিনে আসে
  useEffect(() => {
    const unsubS = onSnapshot(collection(db, 'sales'), snap => {
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() })) as Sale[];
      data.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
      setSales(data);
      setLoading(false);
    });
    const unsubP = onSnapshot(collection(db, 'products'), snap => {
      setProducts(snap.docs.map(d => ({ id: d.id, ...d.data() })) as Product[]);
    });
    getBalance().then(r => setBalance(r.current_balance)).catch(() => setBalance(null));
    return () => { unsubS(); unsubP(); };
  }, []);

  // পরের ইনভয়েস নম্বর — TGZ-১০০১, ১০০২ ...
  const nextInvoice = useMemo(() => {
    let max = 1000;
    sales.forEach(s => {
      const m = /TGZ-(\d+)/.exec(s.invoice || '');
      if (m) max = Math.max(max, parseInt(m[1], 10));
    });
    return `TGZ-${max + 1}`;
  }, [sales]);

  const productIndex = useMemo(() => {
    const m = new Map<string, Product>();
    products.forEach(p => {
      if (p.model) m.set(p.model.toLowerCase(), p);
      if (p.name) m.set(p.name.toLowerCase(), p);
    });
    return m;
  }, [products]);

  const allColors = useMemo(
    () => Array.from(new Set(products.flatMap(p => p.colors || []))).sort(),
    [products]
  );

  const categories = useMemo(
    () => Array.from(new Set(products.map(p => (p.category || '').trim()).filter(Boolean))).sort(),
    [products]
  );

  // ---------- list filtering ----------
  const inPeriod = (s: Sale) =>
    period === 'all' ? true :
    period === 'today' ? s.date === todayStr() :
    (s.date || '').startsWith(monthKey);

  const filtered = useMemo(() => sales.filter(s => {
    if (!inPeriod(s)) return false;
    if (channelFilter && (s.customerChannel || '') !== channelFilter) return false;
    if (statusFilter && s.courierDeliveryStatus !== statusFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      const hay = [s.customerRef, s.customerPhone, s.courierTrackingCode, s.model, s.invoice, s.orderNumber]
        .map(v => (v || '').toLowerCase()).join(' ');
      if (!hay.includes(q)) return false;
    }
    return true;
  }), [sales, period, monthKey, channelFilter, statusFilter, search]);

  const statusCounts = useMemo(() => {
    const m: Record<string, number> = {};
    sales.forEach(s => { const k = s.courierDeliveryStatus || 'unknown'; m[k] = (m[k] || 0) + 1; });
    return m;
  }, [sales]);

  // একই হিসাবের নিয়ম — ফেরত/বাতিল বাদ, রিপোর্টের সাথে মিলে
  const totals = useMemo(() => {
    const v = summarize(filtered, []);
    return { bill: v.sales, advance: v.advance, cod: v.codPending, profit: v.salesProfit, delivered: v.delivered };
  }, [filtered]);

  // ---------- form ----------
  const set = <K extends keyof SaleForm>(k: K, v: SaleForm[K]) => setForm(f => ({ ...f, [k]: v }));
  const setLine = (id: string, patch: Partial<Line>) =>
    setForm(f => ({ ...f, lines: f.lines.map(l => (l.id === id ? { ...l, ...patch } : l)) }));

  const pickModel = (id: string, value: string) => {
    const p = productIndex.get(value.trim().toLowerCase());
    const patch: Partial<Line> = { model: value };
    if (p) {
      patch.category = p.category || '';
      patch.purchase = String(p.defaultPurchasePrice || '');
      patch.selling = String(p.defaultSellingPrice || '');
      if (p.colors?.length === 1) patch.color = p.colors[0];
    }
    setLine(id, patch);
  };

  // নির্বাচিত প্রোডাক্টের নিজের রঙ; প্রোডাক্ট না মিললে সব রঙ (নতুন প্রোডাক্টের জন্য)
  const colorsFor = (model: string): string[] => {
    const p = productIndex.get(model.trim().toLowerCase());
    return p ? (p.colors || []) : allColors;
  };

  // ক্যাটাগরি বদলালে ওই ক্যাটাগরির প্রোডাক্টের তালিকা; ক্যাটাগরি না থাকলে সব প্রোডাক্ট
  const modelsFor = (category: string) => {
    const cat = category.trim().toLowerCase();
    const list = cat ? products.filter(p => (p.category || '').trim().toLowerCase() === cat) : products;
    return list;
  };

  // এই নম্বরের আগের সব অর্ডার (এখন এডিট হচ্ছেটা বাদে), নতুন আগে
  const phoneHistory = useMemo(() => {
    const d = digitsOnly(form.phone);
    if (d.length !== 11 || !isPhone(form.phone)) return [] as Sale[];
    return sales.filter(s => s.id !== editId && digitsOnly(s.customerPhone || '') === d);
  }, [sales, form.phone, editId]);

  // ফোন নম্বর মিললে আগের সবচেয়ে নতুন অর্ডারের ঠিকানা, জেলা ও নাম বসে (খালি ঘর ছাড়া কিছু বদলায় না)
  const onPhoneChange = (value: string) => {
    const d = digitsOnly(value);
    const prev = d.length === 11 && isPhone(value)
      ? sales.find(s => digitsOnly(s.customerPhone || '') === d && (s.customerAddress || s.courierArea))
      : undefined;
    setAutoFilled(!!prev);
    setForm(f => ({
      ...f,
      phone: value,
      address: prev && !f.address.trim() ? prev.customerAddress || f.address : f.address,
      district: prev && !f.district.trim() ? prev.courierArea || f.district : f.district,
      customerRef: prev && !f.customerRef.trim() ? prev.customerRef || f.customerRef : f.customerRef,
    }));
  };

  const openAdd = () => {
    setEditId(null);
    setEditingSale(null);
    setForm(emptyForm(nextInvoice));
    setAutoFilled(false);
    setOpen(true);
  };

  const openEdit = (s: Sale) => {
    setEditId(s.id);
    setEditingSale(s);
    setAutoFilled(false);
    const lines: Line[] = (s.items && s.items.length)
      ? s.items.map(it => ({
          id: crypto.randomUUID(),
          category: it.category || productIndex.get((it.model || it.productName || '').trim().toLowerCase())?.category || '',
          model: it.model || it.productName || '',
          color: it.color || '',
          qty: String(it.quantity || 1),
          purchase: String(it.purchasePrice || ''),
          selling: String(it.sellingPrice || ''),
        }))
      : [{ id: crypto.randomUUID(), category: '', model: s.model || '', color: '', qty: String(s.quantity || 1), purchase: String(s.purchasePrice || ''), selling: String(s.sellingPrice || '') }];
    setForm({
      date: s.date || todayStr(),
      saleType: s.saleType || 'Courier Sale',
      channel: s.customerChannel || '',
      customerRef: s.customerRef || '',
      phone: s.customerPhone || '',
      address: s.customerAddress || '',
      district: s.courierArea || '',
      invoice: s.invoice || s.orderNumber || '',
      courierInvoice: s.courierInvoice || '',
      lines,
      courierCharge: String(s.courierCharge ?? 0),
      advance: String(s.advanceAmount ?? 0),
      paymentMethod: s.paymentMethod || '',
      trxId: s.trxId || '',
      otherCost: String(s.otherCost ?? 0),
      deliveryNote: s.deliveryNote || '',
      bookSteadfast: false,
      courierTrackingCode: s.courierTrackingCode || '',
      status: s.courierDeliveryStatus || 'pending',
    });
    setOpen(true);
  };

  const c = calc(form);

  const save = async () => {
    if (c.productTotal <= 0) return alert('প্রোডাক্টের বিক্রয়মূল্য দিন');
    if (!form.lines.some(l => l.model.trim())) return alert('অন্তত একটি প্রোডাক্টের মডেল দিন');
    if (form.phone && !isPhone(form.phone) && !confirm('ফোন নম্বরটি ১১ ডিজিটের মনে হচ্ছে না। তবুও সেভ করবেন?')) return;

    setSaving(true);
    const items = c.lines.filter(l => l.model.trim()).map((l, i) => ({
      id: `item${i + 1}`,
      productId: productIndex.get(l.model.trim().toLowerCase())?.id,
      productName: l.model.trim(),
      model: l.model.trim(),
      category: l.category.trim() || productIndex.get(l.model.trim().toLowerCase())?.category || '',
      color: l.color.trim(),
      quantity: l.qty,
      purchasePrice: l.purchase,
      sellingPrice: l.selling,
      totalPurchase: l.totalPurchase,
      totalSelling: l.totalSelling,
      colorBreakdown: l.color.trim() ? { [l.color.trim()]: l.qty } : {},
    }));
    const isCourier = c.isCourier;
    const qty = c.qtyTotal;

    const payload = cleanObj({
      date: form.date,
      timestamp: new Date(form.date).getTime(),
      saleType: form.saleType,
      model: items.map(i => i.model + (i.color ? ` (${i.color})` : '') + (i.quantity !== 1 ? ` ×${i.quantity}` : '')).join(', '),
      quantity: qty,
      purchasePrice: round2(c.purchaseTotal / qty),
      sellingPrice: round2(c.productTotal / qty),
      salesAmount: c.bill,
      netProfit: c.profit,
      otherCost: c.otherCost,
      items,
      customerRef: form.customerRef.trim() || undefined,
      customerPhone: form.phone.trim() || undefined,
      customerAddress: form.address.trim() || undefined,
      customerChannel: form.channel || undefined,
      invoice: form.invoice || undefined,
      courierInvoice: form.courierInvoice.trim() || undefined,
      advanceAmount: c.advance,
      codAmount: c.cod,
      paymentMethod: isCourier && c.advance > 0 ? form.paymentMethod || undefined : undefined,
      trxId: isCourier && c.advance > 0 ? form.trxId.trim() || undefined : undefined,
      deliveryNote: isCourier ? form.deliveryNote.trim() || undefined : undefined,
      courierName: isCourier ? 'Steadfast' : undefined,
      courierArea: isCourier ? form.district.trim() || undefined : undefined,
      courierCharge: isCourier ? c.courierCharge : undefined,
      courierConditionCost: isCourier ? c.condition : undefined,
      courierTrackingCode: isCourier ? form.courierTrackingCode.trim() || undefined : undefined,
      courierDeliveryStatus: isCourier ? form.status : undefined,
    }) as Record<string, unknown>;

    const stockWarnings: string[] = [];
    try {
      // স্টক হিসাব: নতুন সেল → কমবে; এডিট → আগেরটা ফেরত, নতুনটা কমবে (শুধু নতুন ডেটায়)
      if (editId) {
        if (editingSale && editingSale.stockAdjusted !== undefined) {
          const wantDeduct = shouldDeduct(form.saleType, form.status);
          payload.stockAdjusted = wantDeduct;
          if (editingSale.stockAdjusted) {
            stockWarnings.push(...await applyStock(resolveItems(editingSale.items || [], products), 1));
          }
          if (wantDeduct) {
            stockWarnings.push(...await applyStock(resolveItems(items, products), -1));
          }
        }
        await updateDoc(doc(db, 'sales', editId), payload);
      } else {
        const wantDeduct = shouldDeduct(form.saleType, form.status);
        payload.stockAdjusted = wantDeduct;
        const ref = await addDoc(collection(db, 'sales'), payload);
        if (wantDeduct) {
          stockWarnings.push(...await applyStock(resolveItems(items, products), -1));
        }

        // Steadfast-এ অটো বুকিং
        if (isCourier && form.bookSteadfast && !form.courierTrackingCode.trim()) {
          if (!form.phone.trim() || !form.address.trim() || !form.courierInvoice.trim()) {
            alert('সেল সেভ হয়েছে, কিন্তু Steadfast বুকিংয়ের জন্য ফোন, ঠিকানা ও কুরিয়ার ইনভয়েস লাগবে। এডিট করে আবার চেষ্টা করুন।');
          } else {
            try {
              const address = [form.address.trim(), form.district.trim()].filter(Boolean).join(', ');
              const res = await createParcel({
                invoice: form.courierInvoice.trim(),
                recipient_name: form.customerRef.trim() || 'Customer',
                recipient_phone: form.phone.trim(),
                recipient_address: address,
                cod_amount: c.cod,
                note: form.deliveryNote.trim() || undefined,
              });
              if (res.status === 200 && res.consignment) {
                const { consignment_id, tracking_code } = res.consignment;
                await updateDoc(doc(db, 'sales', ref.id), {
                  courierTrackingCode: tracking_code,
                  courierTrackingId: String(consignment_id),
                  steadfastConsignmentId: consignment_id,
                  courierDeliveryStatus: 'in_review',
                });
              } else {
                const errMsg = res.errors ? JSON.stringify(res.errors) : (res.message || 'Unknown error');
                alert('⚠️ Steadfast বুকিং হয়নি: ' + errMsg + '\n\nসেল সেভ হয়েছে।');
              }
            } catch (err) {
              alert('⚠️ Steadfast বুকিং সমস্যা: ' + String(err) + '\n\nসেল সেভ হয়েছে।');
            }
          }
        }
      }
      setOpen(false);
      if (stockWarnings.length) alert('⚠️ ' + stockWarnings.join('\n'));
    } catch (err) {
      alert('সেভ করতে সমস্যা: ' + String(err));
    }
    setSaving(false);
  };

  // স্ট্যাটাস বদলালে স্টক ফেরত/কমানো — শুধু নতুন ডেটায়
  const stockForStatus = async (s: Sale, status: string): Promise<{ patch: Partial<Sale>; warnings: string[] }> => {
    if (s.stockAdjusted === undefined) return { patch: {}, warnings: [] };
    const want = shouldDeduct(s.saleType, status);
    if (want === s.stockAdjusted) return { patch: {}, warnings: [] };
    const warnings = await applyStock(resolveItems(s.items || [], products), want ? -1 : 1);
    return { patch: { stockAdjusted: want }, warnings };
  };

  const remove = async (id: string) => {
    if (!confirm('এই সেলস এন্ট্রি মুছে ফেলবেন? এটি ফিরিয়ে আনা যাবে না।')) return;
    setBusyId(id);
    try {
      const s = sales.find(x => x.id === id);
      if (s?.stockAdjusted) {
        await applyStock(resolveItems(s.items || [], products), 1); // স্টক ফেরত
      }
      await deleteDoc(doc(db, 'sales', id));
    } catch (err) {
      alert('মুছতে সমস্যা: ' + String(err));
    }
    setBusyId(null);
  };

  const updateStatus = async (id: string, status: string) => {
    const s = sales.find(x => x.id === id);
    if (!s) return;
    setBusyId(id);
    try {
      const { patch, warnings } = await stockForStatus(s, status);
      await updateDoc(doc(db, 'sales', id), { courierDeliveryStatus: status, ...patch });
      setSales(prev => prev.map(x => (x.id === id ? { ...x, courierDeliveryStatus: status, ...patch } : x)));
      if (warnings.length) alert('⚠️ ' + warnings.join('\n'));
    } catch (err) {
      alert('স্ট্যাটাস আপডেট সমস্যা: ' + String(err));
    }
    setBusyId(null);
  };

  // একটি সেলের স্ট্যাটাস Steadfast থেকে আনা (কনসাইনমেন্ট আইডি না থাকলে ট্র্যাকিং কোড দিয়ে)
  const syncStatus = async (s: Sale) => {
    if (!isTrackable(s)) return alert('এই সেলে Steadfast আইডি বা ট্র্যাকিং কোড নেই');
    setBusyId(s.id);
    try {
      const next = await fetchCourierStatus(s);
      const warnings = await saveCourierStatus(s, next, products);
      if (warnings.length) alert('⚠️ ' + warnings.join('\n'));
    } catch (err) {
      alert('স্ট্যাটাস আনতে সমস্যা: ' + String(err));
    }
    setBusyId(null);
  };

  // সব চলমান কুরিয়ার সেলের স্ট্যাটাস একসাথে আনা
  const [syncingAll, setSyncingAll] = useState(false);
  const syncAll = async () => {
    setSyncingAll(true);
    try {
      const r = await syncCourierStatuses();
      alert(`কুরিয়ার সিঙ্ক শেষ: ${r.checked}টি চেক, ${r.changed}টি আপডেট, ${r.failed}টি ব্যর্থ`);
      if (r.warnings.length) alert('⚠️ ' + r.warnings.join('\n'));
    } catch (err) {
      alert('সিঙ্ক করতে সমস্যা: ' + String(err));
    }
    setSyncingAll(false);
  };

  if (loading) return <Spinner icon="🛵" text="সেলস লোড হচ্ছে..." />;

  const periodLabel = period === 'today' ? 'আজ' : period === 'month' ? monthKey : 'সব সময়';

  return (
    <div className="pb-24 sm:pb-8">
      <PageHeader
        theme="forest"
        title="সেলস ও কুরিয়ার"
        subtitle="অর্ডার, অগ্রিম, COD, Steadfast বুকিং ও ডেলিভারি স্ট্যাটাস"
        actions={
          <>
            <div className="rounded-xl bg-white/10 px-3 py-2 text-xs">
              <span className="text-emerald-200">Steadfast ব্যালেন্স </span>
              <span className="font-bold tabular-nums">{balance === null ? '—' : BDT(balance)}</span>
            </div>
            <Button variant="ghost" onClick={syncAll} disabled={syncingAll} className="w-full sm:w-auto">
              {syncingAll ? 'সিঙ্ক হচ্ছে…' : '🔄 কুরিয়ার সিঙ্ক'}
            </Button>
            <Button variant="accent" onClick={openAdd} className="w-full sm:w-auto">＋ নতুন সেল</Button>
          </>
        }
      />

      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="মোট বিল" value={BDT(totals.bill)} sub={`${filtered.length}টি অর্ডার · ${periodLabel}`} tone="blue" icon="💰" />
        <StatCard label="অগ্রিম পেমেন্ট" value={BDT(totals.advance)} sub="কাস্টমার আগেই দিয়েছে" tone="green" icon="💳" />
        <StatCard label="COD বাকি" value={BDT(totals.cod)} sub={`${totals.delivered}টি ডেলিভারি হয়েছে`} tone="amber" icon="🏍️" />
        <StatCard label="নেট লাভ" value={BDT(totals.profit)} sub="খরচ বাদে" tone="violet" icon="📈" />
      </div>

      {/* Filters */}
      <Card className="mb-4 p-3 sm:p-4">
        <div className="flex items-center gap-2 overflow-x-auto pb-1 [scrollbar-width:none] md:flex-wrap md:overflow-visible">
          <Chip active={period === 'today'} onClick={() => setPeriod('today')}>আজ</Chip>
          <Chip active={period === 'month'} onClick={() => setPeriod('month')}>মাস</Chip>
          <Chip active={period === 'all'} onClick={() => setPeriod('all')}>সব</Chip>
          {period === 'month' && (
            <input type="month" value={monthKey} onChange={e => setMonthKey(e.target.value)}
              className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs" />
          )}
          <span className="mx-1 hidden h-5 w-px bg-slate-200 sm:block" />
          <Chip active={!channelFilter} onClick={() => setChannelFilter('')}>সব চ্যানেল</Chip>
          {CHANNELS.map(ch => (
            <Chip key={ch} active={channelFilter === ch} onClick={() => setChannelFilter(channelFilter === ch ? '' : ch)}>{ch}</Chip>
          ))}
        </div>
        <div className="mt-3 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none]">
          <Chip active={!statusFilter} onClick={() => setStatusFilter('')}>সব স্ট্যাটাস ({sales.length})</Chip>
          {Object.entries(STATUS_CONFIG).map(([k, cfg]) => statusCounts[k] ? (
            <Chip key={k} active={statusFilter === k} tone={cfg.tone === 'red' ? 'red' : 'green'}
              onClick={() => setStatusFilter(statusFilter === k ? '' : k)}>
              {cfg.label} ({statusCounts[k]})
            </Chip>
          ) : null)}
        </div>
        <input type="search" value={search} onChange={e => setSearch(e.target.value)}
          placeholder="খুঁজুন — নাম, ফোন, ট্র্যাকিং কোড, মডেল, ইনভয়েস..." className={cn(inputCls, 'mt-3')} />
      </Card>

      {filtered.length === 0 ? (
        <Card>
          <Empty icon="🛵" text="কোনো সেলস পাওয়া যায়নি"
            action={<Button variant="primary" onClick={openAdd}>＋ নতুন সেল এন্ট্রি</Button>} />
        </Card>
      ) : (
        <Card className="overflow-hidden">
          {/* Desktop table */}
          <div className="hidden overflow-x-auto xl:block">
            <table className="w-full text-sm">
              <thead className="bg-[#0E3B2C] text-left text-xs font-semibold text-[#FDEBD9]">
                <tr>
                  <th className="px-4 py-3">ইনভয়েস / তারিখ</th>
                  <th className="px-4 py-3">কাস্টমার</th>
                  <th className="px-4 py-3">প্রোডাক্ট</th>
                  <th className="px-4 py-3 text-right">বিল / অগ্রিম / COD</th>
                  <th className="px-4 py-3">ট্র্যাকিং</th>
                  <th className="px-4 py-3 text-right">নেট লাভ</th>
                  <th className="px-4 py-3">স্ট্যাটাস</th>
                  <th className="px-4 py-3 text-center">অ্যাকশন</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F3E2D0]">
                {filtered.map(s => <SaleRowDesktop key={s.id} s={s} busy={busyId === s.id}
                  onEdit={openEdit} onDelete={remove} onStatus={updateStatus} onSync={syncStatus} />)}
              </tbody>
            </table>
          </div>

          {/* Tablet & mobile cards */}
          <ul className="divide-y divide-[#F3E2D0] xl:hidden">
            {filtered.map(s => <SaleCard key={s.id} s={s} busy={busyId === s.id}
              onEdit={openEdit} onDelete={remove} onStatus={updateStatus} onSync={syncStatus} />)}
          </ul>

          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[#F3E2D0] bg-[#FFF4EA] px-4 py-3 text-sm">
            <span className="font-bold text-[#0E3B2C]">মোট {filtered.length}টি · ডেলিভারি {totals.delivered}টি</span>
            <span className="font-bold tabular-nums text-[#14513B]">লাভ {BDT(totals.profit)}</span>
          </div>
        </Card>
      )}

      <button type="button" onClick={openAdd}
        className="fixed bottom-20 right-4 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-[#F26B1D] text-2xl text-white shadow-xl transition active:scale-95 md:hidden"
        aria-label="নতুন সেল">＋</button>

      {/* ===== Add / Edit ===== */}
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        wide
        tone="green"
        title={editId ? 'সেল এডিট করুন' : 'নতুন সেল ও কুরিয়ার এন্ট্রি'}
        footer={
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="grid grid-cols-3 gap-3 text-xs sm:flex sm:gap-5">
              <div><div className="text-slate-500">মোট বিল</div><div className="font-bold tabular-nums text-slate-900">{BDT(c.bill)}</div></div>
              {c.isCourier && <div><div className="text-slate-500">COD</div><div className="font-bold tabular-nums text-amber-700">{BDT(c.cod)}</div></div>}
              <div><div className="text-slate-500">নেট লাভ</div><div className={cn('font-bold tabular-nums', c.profit >= 0 ? 'text-emerald-700' : 'text-rose-600')}>{BDT(c.profit)}</div></div>
            </div>
            <div className="flex gap-2">
              <Button variant="soft" onClick={() => setOpen(false)} className="flex-1 sm:flex-none">বাতিল</Button>
              <Button variant="primary" onClick={save} disabled={saving} className="flex-1 sm:flex-none">
                {saving ? 'সেভ হচ্ছে…' : editId ? 'আপডেট করুন' : 'সেভ ও বুক করুন'}
              </Button>
            </div>
          </div>
        }
      >
        <div className="space-y-5">
          {/* Sale type & channel */}
          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <label className={labelCls}>সেল টাইপ</label>
              <div className="grid grid-cols-2 gap-1.5 rounded-xl bg-[#BFE0CE] p-1">
                {(['Courier Sale', 'Direct Sale'] as const).map(t => (
                  <button key={t} type="button" onClick={() => set('saleType', t)}
                    className={cn('rounded-lg py-2 text-xs font-semibold transition',
                      form.saleType === t ? 'bg-[#0E3B2C] text-white shadow-sm' : 'text-[#2F4F3E] hover:bg-white/50')}>
                    {t === 'Courier Sale' ? '🛵 কুরিয়ার' : '🏪 সরাসরি'}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className={labelCls}>তারিখ</label>
              <input type="date" value={form.date} onChange={e => set('date', e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>ইনভয়েস নম্বর (কুরিয়ারে যাবে না)</label>
              <input value={form.invoice} onChange={e => set('invoice', e.target.value)} className={cn(inputCls, 'font-mono')} />
            </div>
          </div>

          <div>
            <label className={labelCls}>কাস্টমার কোথা থেকে এসেছে</label>
            <div className="flex flex-wrap gap-2">
              {CHANNELS.map(ch => (
                <Chip key={ch} active={form.channel === ch} onClick={() => set('channel', ch)}>{ch}</Chip>
              ))}
            </div>
          </div>

          {/* Customer */}
          <Section title="👤 কাস্টমার" tone="blue">
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className={labelCls}>নাম</label>
                <input value={form.customerRef} onChange={e => set('customerRef', e.target.value)} className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>মোবাইল নম্বর</label>
                <input type="tel" inputMode="tel" value={form.phone} onChange={e => onPhoneChange(e.target.value)}
                  placeholder="01XXXXXXXXX" className={cn(inputCls, form.phone && !isPhone(form.phone) && 'border-rose-400')} />
                {form.phone && !isPhone(form.phone) && <p className="mt-1 text-[11px] text-rose-600">১১ ডিজিট হতে হবে</p>}
                {phoneHistory.length > 0 && (
                  <div className="mt-2 rounded-xl border border-[#F5C9A0] bg-[#FFF4EA] p-3">
                    <div className="mb-2 flex items-center justify-between gap-2 text-xs">
                      <span className="font-semibold text-emerald-900">✓ এই নম্বরে আগের অর্ডার: {phoneHistory.length} টি</span>
                      {autoFilled && <span className="text-[11px] text-emerald-700">ঠিকানা বসানো হয়েছে</span>}
                    </div>
                    <div className="space-y-1.5">
                      {phoneHistory.slice(0, 3).map(s => (
                        <div key={s.id} className="flex items-center justify-between gap-2 rounded-lg bg-white/80 px-2.5 py-1.5 text-[11px] ring-1 ring-emerald-100">
                          <span className="min-w-0 truncate text-slate-600">{s.date} · {s.model || '—'}</span>
                          <span className="shrink-0 font-semibold tabular-nums text-emerald-800">{BDT(s.salesAmount || 0)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              <div className="sm:col-span-2">
                <label className={labelCls}>ডেলিভারি ঠিকানা</label>
                <input value={form.address} onChange={e => set('address', e.target.value)}
                  placeholder="বাসা, রোড, থানা" className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>জেলা / এলাকা</label>
                <input value={form.district} onChange={e => set('district', e.target.value)}
                  placeholder="ঢাকা, চট্টগ্রাম..." className={inputCls} />
              </div>
            </div>
          </Section>

          {/* Items */}
          <Section title="📦 প্রোডাক্ট" tone="green"
            right={<Button variant="ghost" className="!py-1.5 !text-xs" onClick={() => set('lines', [...form.lines, newLine()])}>＋ আরেকটি প্রোডাক্ট</Button>}>
            <div className="space-y-3">
              {c.lines.map((l, i) => (
                <div key={l.id} className="rounded-xl border border-[#9FCDB4] bg-[#EEF8F3] p-3">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <span className="shrink-0 text-[11px] font-semibold text-[#2F4F3E]">আইটেম #{i + 1}</span>
                    <div className="min-w-0 flex-1">
                      <Suggest
                        value={l.category}
                        placeholder="ক্যাটাগরি (যেমন: Smart Watch)"
                        className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs focus:border-[#14513B] focus:outline-none"
                        options={categories.map(cat => ({ label: cat }))}
                        onType={v => setLine(l.id, { category: v })}
                        onPick={v => setLine(l.id, { category: v })}
                      />
                    </div>
                    {form.lines.length > 1 && (
                      <button type="button" className="text-xs text-rose-600"
                        onClick={() => set('lines', form.lines.filter(x => x.id !== l.id))}>মুছুন</button>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-12">
                    <div className="col-span-2 sm:col-span-4">
                      <Suggest
                        value={l.model}
                        placeholder="মডেল / প্রোডাক্ট"
                        className={modelCls}
                        options={modelsFor(l.category).map(p => ({ label: p.model || p.name, sub: p.category || undefined }))}
                        onType={v => pickModel(l.id, v)}
                        onPick={v => pickModel(l.id, v)}
                      />
                    </div>
                    <div className="col-span-1 sm:col-span-2">
                      <Suggest
                        value={l.color}
                        placeholder="কালার"
                        className={inputCls}
                        options={colorsFor(l.model).map(col => ({ label: col }))}
                        onType={v => setLine(l.id, { color: v })}
                        onPick={v => setLine(l.id, { color: v })}
                      />
                    </div>
                    <div className="col-span-1 sm:col-span-2">
                      <input type="number" inputMode="numeric" min={1} value={l.qty} placeholder="পরিমাণ"
                        onChange={e => setLine(l.id, { qty: e.target.value })} className={inputCls} />
                    </div>
                    <div className="col-span-1 sm:col-span-2">
                      <input type="number" inputMode="decimal" value={l.selling} placeholder="বিক্রয় ৳"
                        onChange={e => setLine(l.id, { selling: e.target.value })} className={inputCls} />
                    </div>
                    <div className="col-span-1 sm:col-span-2">
                      <input type="number" inputMode="decimal" value={l.purchase} placeholder="ক্রয় ৳"
                        onChange={e => setLine(l.id, { purchase: e.target.value })} className={inputCls} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <p className="mt-2 text-[11px] text-slate-400">মডেল লিখলে স্টক ও দাম থেকে অটো ভরবে। এক অর্ডারে একাধিক প্রোডাক্ট দিতে পারবেন।</p>
          </Section>

          {/* Delivery & payment */}
          {c.isCourier && (
            <>
              <Section title="🚚 ডেলিভারি চার্জ" tone="amber">
                <div className="flex flex-wrap gap-2">
                  {DELIVERY_CHIPS.map(v => (
                    <Chip key={v} active={num(form.courierCharge) === v} onClick={() => set('courierCharge', String(v))}>
                      {v === 0 ? 'ফ্রি' : `৳${v}`}
                    </Chip>
                  ))}
                  <input type="number" inputMode="decimal" value={form.courierCharge}
                    onChange={e => set('courierCharge', e.target.value)}
                    className="w-24 rounded-full border border-slate-200 px-3 py-1.5 text-xs" />
                </div>
              </Section>

              <Section title="💳 অগ্রিম ও পেমেন্ট" tone="violet">
                <div className="flex flex-wrap gap-2">
                  <Chip active={num(form.advance) === 0} onClick={() => set('advance', '0')}>Full COD</Chip>
                  <Chip active={num(form.advance) === c.bill && c.bill > 0} onClick={() => set('advance', String(c.bill))}>সম্পূর্ণ পরিশোধ</Chip>
                  {ADVANCE_CHIPS.map(v => (
                    <Chip key={v} active={num(form.advance) === v} onClick={() => set('advance', String(v))}>৳{v}</Chip>
                  ))}
                </div>
                <div className="mt-3 grid gap-3 sm:grid-cols-3">
                  <div>
                    <label className={labelCls}>অগ্রিমের পরিমাণ</label>
                    <input type="number" inputMode="decimal" value={form.advance} onChange={e => set('advance', e.target.value)} className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>পেমেন্ট মাধ্যম</label>
                    <select value={form.paymentMethod} onChange={e => set('paymentMethod', e.target.value)} className={inputCls}>
                      <option value="">— নির্বাচন —</option>
                      {PAYMENT_METHODS.map(m => <option key={m} value={m}>{m}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className={labelCls}>TrxID / নোট</label>
                    <input value={form.trxId} onChange={e => set('trxId', e.target.value)} placeholder="ট্রানজেকশন আইডি" className={inputCls} />
                  </div>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2 rounded-xl bg-white p-3 text-sm sm:grid-cols-4">
                  <div><div className="text-[11px] text-slate-500">প্রোডাক্ট + ডেলিভারি</div><div className="font-bold tabular-nums">{BDT(c.bill)}</div></div>
                  <div><div className="text-[11px] text-slate-500">অগ্রিম</div><div className="font-bold tabular-nums text-emerald-700">{BDT(c.advance)}</div></div>
                  <div><div className="text-[11px] text-slate-500">COD বাকি</div><div className="font-bold tabular-nums text-amber-700">{BDT(c.cod)}</div></div>
                  <div><div className="text-[11px] text-slate-500">কন্ডিশন চার্জ (১%)</div><div className="font-bold tabular-nums text-rose-600">{BDT(c.condition)}</div></div>
                </div>
              </Section>

              <Section title="📝 রাইডারের নির্দেশনা" tone="slate">
                <textarea rows={2} value={form.deliveryNote} onChange={e => set('deliveryNote', e.target.value)} className={inputCls} />
              </Section>

              <Section title="🔗 Steadfast" tone="green">
                {!editId && (
                  <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-[#F5C9A0] bg-[#FFF4EA] p-3">
                    <input type="checkbox" className="mt-1 h-4 w-4 accent-[#F26B1D]" checked={form.bookSteadfast}
                      onChange={e => set('bookSteadfast', e.target.checked)} />
                    <span className="text-sm">
                      <span className="font-semibold text-emerald-900">সেভ করার সাথেই Steadfast-এ পার্সেল বুক করুন</span>
                      <span className="block text-xs text-slate-500">ট্র্যাকিং কোড ও Consignment ID অটো সেভ হবে</span>
                    </span>
                  </label>
                )}
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <div className="sm:col-span-2">
                    <label className={labelCls}>কুরিয়ার ইনভয়েস</label>
                    <input value={form.courierInvoice} onChange={e => set('courierInvoice', e.target.value)}
                      placeholder="Steadfast-এ এই নম্বরটি যাবে" className={cn(inputCls, 'font-mono')} />
                    <p className="mt-1 text-[11px] text-slate-500">ওপরের TGZ ইনভয়েস কুরিয়ারে যাবে না। কুরিয়ারের ইনভয়েস এখানে আলাদা করে লিখুন।</p>
                  </div>
                  <div>
                    <label className={labelCls}>স্ট্যাটাস</label>
                    <select value={form.status} onChange={e => set('status', e.target.value)} className={inputCls}>
                      {Object.entries(STATUS_CONFIG).map(([k, cfg]) => <option key={k} value={k}>{cfg.label}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className={labelCls}>ট্র্যাকিং কোড (ঐচ্ছিক)</label>
                    <input value={form.courierTrackingCode} onChange={e => set('courierTrackingCode', e.target.value)}
                      placeholder="ফাঁকা থাকলে অটো বুক হবে" className={cn(inputCls, 'font-mono')} />
                  </div>
                </div>
              </Section>
            </>
          )}

          {/* Other cost */}
          <Section title="🧾 অন্যান্য খরচ" tone="slate">
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className={labelCls}>প্যাকেজিং / অন্যান্য (৳)</label>
                <input type="number" inputMode="decimal" value={form.otherCost} onChange={e => set('otherCost', e.target.value)} className={inputCls} />
              </div>
              <div className="flex items-end">
                <div className="w-full rounded-xl bg-slate-100 px-3 py-2.5 text-xs text-slate-600">
                  নেট লাভ = বিল − ক্রয়মূল্য − কুরিয়ার চার্জ − কন্ডিশন চার্জ − অন্যান্য খরচ
                </div>
              </div>
            </div>
          </Section>
        </div>
      </Modal>
    </div>
  );
}

// ---------- small pieces ----------
type SuggestOption = { label: string; sub?: string };

// মডেলের ঘর — আইটেমের মধ্যে আলাদা করে দেখানোর জন্য কমলা-পীচ
const modelCls =
  'w-full rounded-xl border border-[#F5C9A0] bg-[#FFF1E4] px-3 py-2.5 text-sm font-semibold text-[#0E3B2C] ' +
  'placeholder:font-normal placeholder:text-[#B9895F] focus:border-[#F26B1D] focus:outline-none focus:ring-2 focus:ring-[#F26B1D]/25 transition';

// নিজস্ব সাজেশন বক্স — ঘরে লেখা থাকলেও পুরো তালিকা দেখায়, তাই আগের লেখা মুছতে হয় না
function Suggest({
  value, options, onType, onPick, placeholder, className,
}: {
  value: string; options: SuggestOption[]; onType: (v: string) => void; onPick: (v: string) => void;
  placeholder?: string; className?: string;
}) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const q = value.trim().toLowerCase();
  const exact = !!q && options.some(o => o.label.toLowerCase() === q);
  const shown = !q || exact ? options : options.filter(o => o.label.toLowerCase().includes(q));
  // ফোকাস হলে ঘরটা ও তার সাজেশন বক্স স্ক্রিনের মাঝে আনে, যাতে তালিকা নিচে আটকে না থাকে
  const reveal = () => {
    window.setTimeout(() => wrapRef.current?.scrollIntoView({ block: 'center', behavior: 'smooth' }), 150);
  };
  return (
    <div className="relative" ref={wrapRef}>
      <input
        value={value}
        placeholder={placeholder}
        className={className}
        onFocus={() => { setOpen(true); reveal(); }}
        onBlur={() => setOpen(false)}
        onChange={e => { onType(e.target.value); setOpen(true); }}
      />
      {open && shown.length > 0 && (
        <div className="absolute left-0 right-0 z-30 mt-1 max-h-60 overflow-auto rounded-xl border border-[#EBCFB2] bg-white p-1 shadow-xl shadow-[#0E3B2C]/10">
          {shown.slice(0, 60).map((o, idx) => (
            <button
              type="button"
              key={`${o.label}-${idx}`}
              onMouseDown={e => { e.preventDefault(); onPick(o.label); setOpen(false); }}
              className="flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-left text-sm text-slate-700 hover:bg-[#FFF4EA] hover:text-[#0E3B2C]"
            >
              <span className="truncate">{o.label}</span>
              {o.sub && <span className="shrink-0 text-[11px] text-slate-400">{o.sub}</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function Section({
  title, tone, children, right,
}: { title: string; tone: 'blue' | 'green' | 'amber' | 'violet' | 'slate'; children: React.ReactNode; right?: React.ReactNode }) {
  // প্রতিটি সেকশনের নিজের সবুজ শেড; উপরের মোটা দাগ সেই শেডের গাঢ় রূপ। ইনপুট সাদা রাখা হয়েছে, তাই পড়া সহজ।
  const shade = {
    blue: { bg: '#D3EDE4', bar: '#0F766E' },
    green: { bg: '#C4E3D1', bar: '#14513B' },
    amber: { bg: '#DCEEC9', bar: '#5B8E2E' },
    violet: { bg: '#CFE5D9', bar: '#2F4F3E' },
    slate: { bg: '#DDF0E7', bar: '#0B4F4A' },
  }[tone];
  return (
    <div
      className="rounded-2xl border border-[#A9D3BD] border-t-4 p-4 shadow-sm"
      style={{ background: shade.bg, borderTopColor: shade.bar }}
    >
      <div className="mb-3 flex items-center justify-between gap-2">
        <span className="text-sm font-bold tracking-tight text-[#0E3B2C]">{title}</span>
        {right}
      </div>
      {children}
    </div>
  );
}

function StatusSelect({ value, disabled, onChange }: { value: string; disabled?: boolean; onChange: (v: string) => void }) {
  const cfg = STATUS_CONFIG[value];
  return (
    <select value={value || 'pending'} disabled={disabled} onChange={e => onChange(e.target.value)}
      className={cn(
        'max-w-[170px] cursor-pointer rounded-lg border-0 px-2 py-1.5 text-xs font-semibold ring-1 transition disabled:opacity-50',
        cfg?.tone === 'green' && 'bg-emerald-50 text-emerald-700 ring-emerald-200',
        cfg?.tone === 'red' && 'bg-rose-50 text-rose-700 ring-rose-200',
        cfg?.tone === 'blue' && 'bg-blue-50 text-blue-700 ring-blue-200',
        cfg?.tone === 'amber' && 'bg-amber-50 text-amber-800 ring-amber-200',
        cfg?.tone === 'violet' && 'bg-violet-50 text-violet-700 ring-violet-200',
        (!cfg || cfg.tone === 'slate') && 'bg-slate-100 text-slate-700 ring-slate-200'
      )}>
      {Object.entries(STATUS_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
    </select>
  );
}

function itemsText(s: Sale) {
  if (s.items?.length) {
    return s.items.map(i => `${i.model || i.productName}${i.color ? ` (${i.color})` : ''}${i.quantity > 1 ? ` ×${i.quantity}` : ''}`).join(', ');
  }
  return s.model || '—';
}

interface RowProps {
  s: Sale;
  busy: boolean;
  onEdit: (s: Sale) => void;
  onDelete: (id: string) => void;
  onStatus: (id: string, v: string) => void;
  onSync: (s: Sale) => void;
}

function Actions({ s, busy, onEdit, onDelete, onSync }: RowProps) {
  const canSync = isTrackable(s);
  return (
    <div className="flex items-center gap-1.5">
      <IconButton tone="blue" title="এডিট" onClick={() => onEdit(s)}>✏️</IconButton>
      {canSync && (
        <IconButton tone="amber" title="Steadfast স্ট্যাটাস আনুন" disabled={busy} onClick={() => onSync(s)}>{busy ? '…' : '🔄'}</IconButton>
      )}
      <IconButton tone="red" title="মুছুন" disabled={busy} onClick={() => onDelete(s.id)}>🗑️</IconButton>
    </div>
  );
}

function SaleRowDesktop(p: RowProps) {
  const { s, busy, onStatus } = p;
  const isCourier = s.saleType === 'Courier Sale';
  return (
    <tr className="align-top transition hover:bg-[#FFF4EA]">
      <td className="px-4 py-3">
        <div className="font-mono text-xs font-semibold text-emerald-900">{s.invoice || s.id.slice(0, 8).toUpperCase()}</div>
        <div className="text-[11px] tabular-nums text-slate-400">{s.date}</div>
        {s.customerChannel && <div className="mt-1"><Badge tone={s.customerChannel === 'TikTok' ? 'violet' : s.customerChannel === 'Facebook' ? 'blue' : 'slate'}>{s.customerChannel}</Badge></div>}
      </td>
      <td className="max-w-[200px] px-4 py-3">
        <div className="truncate font-semibold text-slate-900">{s.customerRef || 'সরাসরি বিক্রয়'}</div>
        {s.customerPhone && <div className="text-xs text-slate-500">📞 {s.customerPhone}</div>}
        {s.customerAddress && <div className="truncate text-[11px] text-slate-400" title={s.customerAddress}>📍 {s.customerAddress}</div>}
      </td>
      <td className="max-w-[220px] px-4 py-3 text-xs text-slate-700">
        <div className="line-clamp-2">{itemsText(s)}</div>
        <div className="mt-0.5 text-[11px] text-slate-400">Qty {s.quantity || 1}</div>
      </td>
      <td className="px-4 py-3 text-right tabular-nums">
        <div className="font-bold text-slate-900">{BDT(s.salesAmount || 0)}</div>
        {(s.advanceAmount || 0) > 0 && <div className="text-[11px] text-emerald-600">অগ্রিম {BDT(s.advanceAmount || 0)}</div>}
        {(s.codAmount || 0) > 0 && <div className="text-[11px] text-amber-700">COD {BDT(s.codAmount || 0)}</div>}
      </td>
      <td className="px-4 py-3">
        {s.courierTrackingCode ? (
          <>
            <div className="font-mono text-xs font-semibold text-blue-700">{s.courierTrackingCode}</div>
            <div className="text-[11px] text-slate-400">{s.courierName} · চার্জ {BDT(s.courierCharge || 0)}</div>
          </>
        ) : <span className="text-slate-300">—</span>}
      </td>
      <td className={cn('px-4 py-3 text-right font-bold tabular-nums', (s.netProfit || 0) >= 0 ? 'text-emerald-600' : 'text-rose-600')}>
        {BDT(s.netProfit || 0)}
      </td>
      <td className="px-4 py-3">
        {isCourier
          ? <StatusSelect value={s.courierDeliveryStatus || 'pending'} disabled={busy} onChange={v => onStatus(s.id, v)} />
          : <Badge tone="green">সরাসরি</Badge>}
      </td>
      <td className="px-4 py-3"><div className="flex justify-center"><Actions {...p} /></div></td>
    </tr>
  );
}

function SaleCard(p: RowProps) {
  const { s, busy, onStatus } = p;
  const isCourier = s.saleType === 'Courier Sale';
  return (
    <li className="px-4 py-3.5 transition hover:bg-[#FFF4EA]">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="font-mono text-[11px] font-semibold text-emerald-900">{s.invoice || s.id.slice(0, 8).toUpperCase()}</span>
            <span className="text-[11px] tabular-nums text-slate-400">{s.date}</span>
            {s.customerChannel && <Badge tone={s.customerChannel === 'TikTok' ? 'violet' : s.customerChannel === 'Facebook' ? 'blue' : 'slate'}>{s.customerChannel}</Badge>}
          </div>
          <div className="mt-1 truncate text-sm font-semibold text-slate-900">{s.customerRef || 'সরাসরি বিক্রয়'}</div>
          {s.customerPhone && <div className="text-xs text-slate-500">📞 {s.customerPhone}</div>}
          <div className="mt-1 line-clamp-2 text-xs text-slate-600">{itemsText(s)}</div>
        </div>
        <div className="shrink-0 text-right">
          <div className="text-sm font-bold tabular-nums text-slate-900">{BDT(s.salesAmount || 0)}</div>
          <div className={cn('text-xs font-semibold tabular-nums', (s.netProfit || 0) >= 0 ? 'text-emerald-600' : 'text-rose-600')}>লাভ {BDT(s.netProfit || 0)}</div>
        </div>
      </div>

      <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-500 tabular-nums">
        {(s.advanceAmount || 0) > 0 && <span className="text-emerald-600">অগ্রিম {BDT(s.advanceAmount || 0)}</span>}
        {(s.codAmount || 0) > 0 && <span className="text-amber-700">COD {BDT(s.codAmount || 0)}</span>}
        {s.courierTrackingCode && <span className="font-mono text-blue-700">{s.courierTrackingCode}</span>}
      </div>

      <div className="mt-3 flex items-center justify-between gap-2">
        {isCourier
          ? <StatusSelect value={s.courierDeliveryStatus || 'pending'} disabled={busy} onChange={v => onStatus(s.id, v)} />
          : <Badge tone="green">সরাসরি</Badge>}
        <Actions {...p} />
      </div>
    </li>
  );
}
