import { addDoc, collection } from 'firebase/firestore';
import { auth, db } from '../firebase';

export type ActivityKind = 'sale' | 'product' | 'expense';

// কে কখন কী বদলাল তার লগ। লগ লেখা ব্যর্থ হলেও মূল কাজ আটকাবে না।
export async function logActivity(kind: ActivityKind, action: string, detail: string) {
  try {
    await addDoc(collection(db, 'activity'), {
      kind,
      action,
      detail,
      by: auth.currentUser?.email || 'অজানা',
      timestamp: Date.now(),
    });
  } catch {
    // নীরবে এড়িয়ে যাওয়া — ব্যবহারকারী কাজ চালিয়ে যেতে পারবেন
  }
}
