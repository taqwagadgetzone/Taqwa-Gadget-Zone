// কুরিয়ার স্ট্যাটাস সিঙ্ক — Steadfast থেকে বর্তমান স্ট্যাটাস এনে সেল আপডেট করে
// এবং স্ট্যাটাস বদলালে স্টক ঠিক রাখে (আগের ডেটা, যেখানে stockAdjusted নেই, স্টক স্পর্শ হয় না)।
import { collection, doc, getDocs, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import type { Product, Sale } from '../types';
import { getStatusByCid, getStatusByTrackingCode } from './steadfast';
import { applyStock, resolveItems, shouldDeduct } from './stock';

/** এই স্ট্যাটাসে পৌঁছালে আর Steadfast-এ চেক করার দরকার নেই */
export const FINAL_STATUSES = ['delivered', 'cancelled', 'returned_to_merchant', 'partial_returned_to_merchant'];

export const SYNC_INTERVAL_MS = 10 * 60 * 1000;
const LAST_KEY = 'tgz_courier_sync_at';

export const lastSyncAt = (): number => Number(localStorage.getItem(LAST_KEY) || 0);

/** Steadfast-এ খোঁজা সম্ভব কি না (কনসাইনমেন্ট আইডি বা ট্র্যাকিং কোড আছে) */
export function isTrackable(s: Sale): boolean {
  return s.saleType === 'Courier Sale' && !!(s.steadfastConsignmentId || s.courierTrackingId || s.courierTrackingCode);
}

/** আইডি আগে, না হলে ট্র্যাকিং কোড — যেটা কাজ করে সেটা নেয় */
export async function fetchCourierStatus(s: Sale): Promise<string> {
  const cid = s.steadfastConsignmentId || s.courierTrackingId;
  let res: { delivery_status?: string; consignment?: { status: string } } | null = null;
  if (cid) {
    try {
      res = await getStatusByCid(cid);
    } catch (err) {
      if (!s.courierTrackingCode) throw err;
    }
  }
  if (!res?.delivery_status && !res?.consignment?.status && s.courierTrackingCode) {
    res = await getStatusByTrackingCode(s.courierTrackingCode);
  }
  const next = res?.delivery_status || res?.consignment?.status;
  if (!next) throw new Error('Steadfast থেকে স্ট্যাটাস পাওয়া যায়নি');
  return next;
}

/** নতুন স্ট্যাটাস সেভ + স্টক ফেরত/কমানো। ফেরত মানে স্টক ফিরবে, আবার ডেলিভারি মানে স্টক কমবে। */
export async function saveCourierStatus(s: Sale, next: string, products: Product[]): Promise<string[]> {
  const patch: Partial<Sale> = {};
  let warnings: string[] = [];
  if (s.stockAdjusted !== undefined) {
    const want = shouldDeduct(s.saleType, next);
    if (want !== s.stockAdjusted) {
      warnings = await applyStock(resolveItems(s.items || [], products), want ? -1 : 1);
      patch.stockAdjusted = want;
    }
  }
  await updateDoc(doc(db, 'sales', s.id), { courierDeliveryStatus: next, ...patch });
  return warnings;
}

export interface SyncResult { checked: number; changed: number; failed: number; warnings: string[] }

/** সব চলমান কুরিয়ার সেলের স্ট্যাটাস Steadfast থেকে আনে (একসাথে ৩টা করে) */
export async function syncCourierStatuses(): Promise<SyncResult> {
  const [sSnap, pSnap] = await Promise.all([getDocs(collection(db, 'sales')), getDocs(collection(db, 'products'))]);
  const products = pSnap.docs.map(d => ({ id: d.id, ...d.data() })) as Product[];
  const sales = sSnap.docs.map(d => ({ id: d.id, ...d.data() })) as Sale[];
  const targets = sales.filter(s => isTrackable(s) && !FINAL_STATUSES.includes(s.courierDeliveryStatus || ''));

  const result: SyncResult = { checked: targets.length, changed: 0, failed: 0, warnings: [] };
  const CONCURRENCY = 3;
  for (let i = 0; i < targets.length; i += CONCURRENCY) {
    await Promise.all(targets.slice(i, i + CONCURRENCY).map(async s => {
      try {
        const next = await fetchCourierStatus(s);
        if (next !== s.courierDeliveryStatus) {
          result.warnings.push(...await saveCourierStatus(s, next, products));
          result.changed++;
        }
      } catch {
        result.failed++;
      }
    }));
  }
  localStorage.setItem(LAST_KEY, String(Date.now()));
  return result;
}
