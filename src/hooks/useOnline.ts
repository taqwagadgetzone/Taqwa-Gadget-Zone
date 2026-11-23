import { useEffect, useState } from 'react';

// ইন্টারনেট আছে কি না — অফলাইনে ব্যানার দেখাতে ও সেভ আটকাতে
export function useOnline() {
  const [online, setOnline] = useState(() => navigator.onLine);
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);
  return online;
}

/** অফলাইনে ডেটা-বদল আটকানো — সেভ, মোছা, স্ট্যাটাস বদল */
export function ensureOnline(): boolean {
  if (navigator.onLine) return true;
  alert('ইন্টারনেট নেই। এখন শুধু দেখা যাবে। নেট এলে আবার চেষ্টা করুন।');
  return false;
}
