// অ্যাপ খোলা থাকলে কুরিয়ার স্ট্যাটাস নিজে থেকে প্রতি ১০ মিনিটে সিঙ্ক হয়
import { useEffect } from 'react';
import { ATTENTION_STATUSES, lastSyncAt, syncCourierStatuses, SYNC_INTERVAL_MS, type CourierChange } from '../services/courierSync';

const STATUS_BN: Record<string, string> = {
  hold: 'হোল্ড',
  cancelled: 'বাতিল',
  returned_to_courier: 'কুরিয়ারে ফেরত',
  returned_to_merchant: 'ফেরত এসেছে',
  partial_returned_to_merchant: 'আংশিক ফেরত',
};

// মনোযোগ-দরকার স্ট্যাটাস বদলালে ব্রাউজার নোটিফিকেশন (অনুমতি দিলে)
export function notifyCourierChanges(changes: CourierChange[]) {
  const attention = changes.filter(c => ATTENTION_STATUSES.includes(c.status));
  if (attention.length === 0 || !('Notification' in window) || Notification.permission !== 'granted') return;
  const body = attention.slice(0, 5)
    .map(c => `${c.invoice || '—'} ${c.name ? `(${c.name})` : ''}: ${STATUS_BN[c.status] || c.status}`)
    .join('\n');
  new Notification(`কুরিয়ার সতর্কতা — ${attention.length}টি সেল`, { body, tag: 'courier-attention' });
}

let running = false; // একই সময়ে একটার বেশি সিঙ্ক চলবে না

export function useCourierAutoSync(enabled: boolean) {
  useEffect(() => {
    if (!enabled) return;
    const run = async () => {
      if (running || Date.now() - lastSyncAt() < SYNC_INTERVAL_MS) return;
      running = true;
      try {
        const r = await syncCourierStatuses();
        notifyCourierChanges(r.changes);
      } catch (err) {
        console.warn('কুরিয়ার সিঙ্ক ব্যর্থ:', err);
      } finally {
        running = false;
      }
    };
    const first = setTimeout(run, 3000);
    const timer = setInterval(run, 60 * 1000); // প্রতি মিনিটে দেখে, সিঙ্ক হয় ১০ মিনিট পর পর
    return () => {
      clearTimeout(first);
      clearInterval(timer);
    };
  }, [enabled]);
}
