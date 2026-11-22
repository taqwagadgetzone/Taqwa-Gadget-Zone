// ব্যবসার হিসাবের একক নিয়ম — ড্যাশবোর্ড, রিপোর্ট ও CSV সবাই এখান থেকে নেয়
//
//  সেলস লাভ (netProfit)  = বিল − পণ্যের ক্রয়মূল্য − কুরিয়ার চার্জ − COD কন্ডিশন চার্জ − অন্যান্য সেল খরচ
//  নেট লাভ              = মোট সেলস লাভ − মোট খরচ (বিজ্ঞাপন + প্যাকেজিং + রিটার্ন + অন্যান্য)
//  চ্যানেল লাভ          = ওই চ্যানেলের সেলস লাভ − ওই চ্যানেলের বিজ্ঞাপন খরচ
//
// ফেরত/বাতিল কুরিয়ার সেল আয়ে ধরা হয় না (কিন্তু অর্ডার সংখ্যায় থাকে)।
import type { Expense, Product, Sale, SaleItem } from '../types';
import { RETURNED_STATUSES } from './stock';

export type Channel = 'Facebook' | 'TikTok' | 'Other';
export const CHANNELS: Channel[] = ['Facebook', 'TikTok', 'Other'];

const AD_CHANNEL: Record<string, Channel> = { 'Facebook Ads': 'Facebook', 'TikTok Ads': 'TikTok' };
export const AD_CATEGORIES = Object.keys(AD_CHANNEL);

export type Range = { kind: 'day'; date: string } | { kind: 'month'; month: string } | { kind: 'all' };

export const inRange = (date: string | undefined, r: Range) =>
  r.kind === 'all' ? true : r.kind === 'day' ? date === r.date : !!date && date.startsWith(r.month);

export const isLost = (s: Sale) => RETURNED_STATUSES.includes(s.courierDeliveryStatus || '');
export const isDelivered = (s: Sale) => s.courierDeliveryStatus === 'delivered';
export const isCourier = (s: Sale) => s.saleType === 'Courier Sale';

export const channelOfSale = (s: Sale): Channel =>
  s.customerChannel === 'Facebook' ? 'Facebook' : s.customerChannel === 'TikTok' ? 'TikTok' : 'Other';
export const channelOfExpense = (e: Expense): Channel => AD_CHANNEL[e.category] ?? 'Other';

const n = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : 0);
const sum = <T,>(arr: T[], f: (x: T) => number | undefined) => arr.reduce((t, x) => t + n(f(x)), 0);

export const saleProfit = (s: Sale) => n(s.netProfit);

/** পণ্যের ক্রয়মূল্য (আইটেম থেকে, না থাকলে legacy ফিল্ড থেকে) */
export const saleCost = (s: Sale) =>
  s.items?.length
    ? sum(s.items, i => i.totalPurchase ?? n(i.purchasePrice) * (i.quantity || 1))
    : n(s.purchasePrice) * (s.quantity || 1);

// ---------- Summary ----------
export interface Summary {
  orders: number;
  lost: number;
  delivered: number;
  open: number;          // কুরিয়ার, এখনো ডেলিভারি হয়নি (ফেরত ছাড়া)
  sales: number;         // মোট বিল (ডেলিভারি চার্জসহ)
  cogs: number;          // পণ্যের ক্রয়মূল্য
  courier: number;       // কুরিয়ার চার্জ
  condition: number;     // COD কন্ডিশন চার্জ
  otherCost: number;     // সেল-ভিত্তিক অন্যান্য খরচ
  salesProfit: number;
  expenses: number;      // সব খরচ
  ads: Record<'Facebook' | 'TikTok', number>;
  adTotal: number;
  netProfit: number;
  advance: number;       // অগ্রিম আদায় (আয়ে থাকা অর্ডার)
  codPending: number;    // কুরিয়ারে বাকি COD
  codCollected: number;  // ডেলিভারি হওয়া COD
  usd: number;           // ডলারে পেমেন্ট মোট
}

export function summarize(sales: Sale[], expenses: Expense[]): Summary {
  const valid = sales.filter(s => !isLost(s));
  const courierValid = valid.filter(isCourier);
  const adFB = sum(expenses.filter(e => channelOfExpense(e) === 'Facebook'), e => e.amount);
  const adTT = sum(expenses.filter(e => channelOfExpense(e) === 'TikTok'), e => e.amount);
  const salesProfit = sum(valid, saleProfit);
  const expTotal = sum(expenses, e => e.amount);
  return {
    orders: sales.length,
    lost: sales.length - valid.length,
    delivered: valid.filter(isDelivered).length,
    open: courierValid.filter(s => !isDelivered(s)).length,
    sales: sum(valid, s => s.salesAmount),
    cogs: sum(valid, saleCost),
    courier: sum(valid, s => s.courierCharge),
    condition: sum(valid, s => s.courierConditionCost),
    otherCost: sum(valid, s => s.otherCost),
    salesProfit,
    expenses: expTotal,
    ads: { Facebook: adFB, TikTok: adTT },
    adTotal: adFB + adTT,
    netProfit: salesProfit - expTotal,
    advance: sum(valid, s => s.advanceAmount),
    codPending: sum(courierValid.filter(s => !isDelivered(s)), s => s.codAmount),
    codCollected: sum(courierValid.filter(isDelivered), s => s.codAmount),
    usd: sum(expenses, e => e.dollarAmount),
  };
}

// ---------- Channel ----------
export interface ChannelRow { orders: number; sales: number; profit: number; ads: number; net: number; roas: number }

export function byChannel(sales: Sale[], expenses: Expense[]): Record<Channel, ChannelRow> {
  const out = {} as Record<Channel, ChannelRow>;
  for (const ch of CHANNELS) {
    const ss = sales.filter(s => !isLost(s) && channelOfSale(s) === ch);
    const ads = ch === 'Other' ? 0 : sum(expenses.filter(e => channelOfExpense(e) === ch), e => e.amount);
    const salesAmt = sum(ss, s => s.salesAmount);
    const profit = sum(ss, saleProfit);
    out[ch] = { orders: ss.length, sales: salesAmt, profit, ads, net: profit - ads, roas: ads > 0 ? salesAmt / ads : 0 };
  }
  return out;
}

// ---------- Daily ----------
export interface DayRow { date: string; orders: number; sales: number; profit: number; expenses: number; net: number }

export function dailySeries(sales: Sale[], expenses: Expense[], dates: string[]): DayRow[] {
  return dates.map(d => {
    const ss = sales.filter(s => s.date === d && !isLost(s));
    const ex = sum(expenses.filter(e => e.date === d), e => e.amount);
    const profit = sum(ss, saleProfit);
    return { date: d, orders: ss.length, sales: sum(ss, s => s.salesAmount), profit, expenses: ex, net: profit - ex };
  });
}

/** রেঞ্জের জন্য তারিখের তালিকা — মাসে মাসের সব দিন (আজের আগ পর্যন্ত), সব সময়ে শেষ ৩০ দিন */
export function datesOf(r: Range, today: string): string[] {
  if (r.kind === 'day') return [r.date];
  const toDate = (d: Date) => d.toISOString().split('T')[0];
  if (r.kind === 'month') {
    const [y, m] = r.month.split('-').map(Number);
    const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
    const end = today.startsWith(r.month) ? Number(today.slice(8, 10)) : last;
    return Array.from({ length: end }, (_, i) => `${r.month}-${String(i + 1).padStart(2, '0')}`);
  }
  const base = new Date(today + 'T00:00:00Z');
  return Array.from({ length: 30 }, (_, i) => {
    const d = new Date(base);
    d.setUTCDate(d.getUTCDate() - (29 - i));
    return toDate(d);
  });
}

export function shiftMonth(month: string, delta: number) {
  const [y, m] = month.split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

// ---------- Breakdowns ----------
export function expenseByCategory(expenses: Expense[]): [string, number][] {
  const m: Record<string, number> = {};
  expenses.forEach(e => { const k = e.category || 'Other'; m[k] = (m[k] || 0) + n(e.amount); });
  return Object.entries(m).sort((a, b) => b[1] - a[1]);
}

export interface ProductRow { name: string; qty: number; revenue: number; profit: number }

export function topProducts(sales: Sale[], limit = 10): ProductRow[] {
  const m = new Map<string, ProductRow>();
  sales.filter(s => !isLost(s)).forEach(s => {
    const items: Partial<SaleItem>[] = s.items?.length ? s.items : [{
      model: s.model, productName: s.model, quantity: s.quantity || 1,
      sellingPrice: s.sellingPrice, purchasePrice: s.purchasePrice,
    }];
    items.forEach(it => {
      const name = (it.model || it.productName || '—').trim();
      const qty = it.quantity || 1;
      const revenue = it.totalSelling ?? n(it.sellingPrice) * qty;
      const cost = it.totalPurchase ?? n(it.purchasePrice) * qty;
      const row = m.get(name) ?? { name, qty: 0, revenue: 0, profit: 0 };
      row.qty += qty;
      row.revenue += revenue;
      row.profit += revenue - cost;
      m.set(name, row);
    });
  });
  return Array.from(m.values()).sort((a, b) => b.qty - a.qty || b.profit - a.profit).slice(0, limit);
}

export function courierStatusCounts(sales: Sale[]): Record<string, number> {
  const m: Record<string, number> = {};
  sales.filter(isCourier).forEach(s => { const k = s.courierDeliveryStatus || 'pending'; m[k] = (m[k] || 0) + 1; });
  return m;
}

export function stockSummary(products: Product[]) {
  return {
    pieces: sum(products, p => p.currentStock),
    value: sum(products, p => p.stockValue),
    out: products.filter(p => n(p.currentStock) <= 0),
    low: products.filter(p => n(p.currentStock) > 0 && n(p.currentStock) <= 5),
  };
}

// ---------- CSV ----------
export function downloadCSV(filename: string, rows: (string | number)[][]) {
  const esc = (v: string | number) => {
    const s = String(v ?? '');
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  // Excel বাংলা ঠিকমতো পড়ার জন্য BOM
  const csv = '﻿' + rows.map(r => r.map(esc).join(',')).join('\n');
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
