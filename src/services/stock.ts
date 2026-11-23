// বিক্রি অনুযায়ী প্রোডাক্ট স্টক ও বিক্রির হিসাব আপডেট
// নিয়ম:
//  - নতুন সেল → স্টক কমে (sign = -1), বিক্রি বাড়ে
//  - সেল ডিলিট / কুরিয়ার ফেরত / বাতিল → স্টক ফেরত আসে (sign = +1)
//  - যে সেলে `stockAdjusted` ফিল্ড নেই (আগের ডেটা), তাতে স্টকে কোনো পরিবর্তন হয় না
import { runTransaction, doc } from 'firebase/firestore';
import { db } from '../firebase';
import type { Product, SaleItem } from '../types';

export const RETURNED_STATUSES = [
  'cancelled',
  'returned_to_merchant',
  'partial_returned_to_merchant',
  'returned_to_courier',
];

/** এই সেলের প্রোডাক্ট কি এখন স্টক থেকে বেরিয়ে আছে? */
export function shouldDeduct(saleType: string, status: string): boolean {
  if (saleType === 'Courier Sale' && RETURNED_STATUSES.includes(status)) return false;
  return true;
}

export function stockStatus(stock: number): 'IN STOCK' | 'LOW STOCK' | 'OUT OF STOCK' {
  if (stock <= 0) return 'OUT OF STOCK';
  if (stock <= 5) return 'LOW STOCK';
  return 'IN STOCK';
}

type LineRef = { productId?: string; model?: string; productName?: string; color?: string; quantity: number };

/** আইটেমে productId না থাকলে মডেল নাম দিয়ে প্রোডাক্ট খুঁজে বের করা */
export function resolveItems(items: Array<Partial<SaleItem> & { quantity?: number | string }>, products: Product[]): LineRef[] {
  const byName = new Map<string, Product>();
  products.forEach(p => {
    if (p.model) byName.set(p.model.toLowerCase(), p);
    if (p.name) byName.set(p.name.toLowerCase(), p);
  });
  return items.map(it => {
    const key = (it.model || it.productName || '').toLowerCase();
    const p = it.productId
      ? products.find(x => x.id === it.productId)
      : byName.get(key);
    return {
      productId: p?.id ?? it.productId,
      model: it.model,
      productName: it.productName,
      color: it.color || '',
      quantity: Math.max(1, Number(it.quantity) || 1),
    };
  });
}

/**
 * sign = -1 → বিক্রির কারণে স্টক কমবে
 * sign = +1 → স্টক ফেরত আসবে
 */
export async function applyStock(lines: LineRef[], sign: 1 | -1): Promise<string[]> {
  const warnings: string[] = [];
  const byProduct = new Map<string, LineRef[]>();
  lines.forEach(l => {
    if (!l.productId) {
      warnings.push(`"${l.model || l.productName}" প্রোডাক্ট তালিকায় পাওয়া যায়নি, স্টক আপডেট হয়নি`);
      return;
    }
    byProduct.set(l.productId, [...(byProduct.get(l.productId) || []), l]);
  });

  for (const [pid, ls] of byProduct) {
    await runTransaction(db, async tx => {
      const ref = doc(db, 'products', pid);
      const snap = await tx.get(ref);
      if (!snap.exists()) return;
      const p = snap.data() as Product;

      const colorStock: Record<string, number> = { ...(p.colorStock || {}) };
      const colorSold: Record<string, number> = { ...(p.colorSold || {}) };
      let currentStock = p.currentStock || 0;
      let totalSold = p.totalSold || 0;

      for (const l of ls) {
        const delta = sign * l.quantity; // স্টকের পরিবর্তন
        currentStock = Math.max(0, currentStock + delta);
        totalSold = Math.max(0, totalSold - delta);
        const c = (l.color || '').trim();
        if (c) {
          colorStock[c] = Math.max(0, (colorStock[c] || 0) + delta);
          colorSold[c] = Math.max(0, (colorSold[c] || 0) - delta);
        }
      }

      tx.update(ref, {
        currentStock,
        totalSold,
        colorStock,
        colorSold,
        stockValue: (p.defaultSellingPrice || 0) * currentStock,
        status: stockStatus(currentStock),
      });
    });
  }
  return warnings;
}

/**
 * ক্রয় বা ফেরত-নষ্ট সমন্বয়ে স্টক বাড়ানো (qty > 0) / কমানো (qty < 0)।
 * বিক্রির totalSold ও colorSold ছোঁয় না — তাই বিক্রির হিসাব বদলায় না।
 */
export async function adjustStock(productId: string | undefined, color: string, qty: number): Promise<void> {
  if (!productId || !qty) return;
  await runTransaction(db, async tx => {
    const ref = doc(db, 'products', productId);
    const snap = await tx.get(ref);
    if (!snap.exists()) return;
    const p = snap.data() as Product;
    const colorStock: Record<string, number> = { ...(p.colorStock || {}) };
    const c = (color || '').trim();
    if (c) colorStock[c] = Math.max(0, (colorStock[c] || 0) + qty);
    const currentStock = Math.max(0, (p.currentStock || 0) + qty);
    tx.update(ref, {
      currentStock,
      colorStock,
      stockValue: (p.defaultSellingPrice || 0) * currentStock,
      status: stockStatus(currentStock),
    });
  });
}
