// অ্যাপ খোলা থাকলে কুরিয়ার স্ট্যাটাস নিজে থেকে প্রতি ১০ মিনিটে সিঙ্ক হয়
import { useEffect } from 'react';
import { lastSyncAt, syncCourierStatuses, SYNC_INTERVAL_MS } from '../services/courierSync';

let running = false; // একই সময়ে একটার বেশি সিঙ্ক চলবে না

export function useCourierAutoSync(enabled: boolean) {
  useEffect(() => {
    if (!enabled) return;
    const run = async () => {
      if (running || Date.now() - lastSyncAt() < SYNC_INTERVAL_MS) return;
      running = true;
      try {
        await syncCourierStatuses();
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
