import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

// কিবোর্ড শর্টকাট (ডেস্কটপ): N = নতুন সেল, / বা Ctrl/⌘+K = দ্রুত খোঁজ
// লেখার ঘরে থাকলে শর্টকাট কাজ করে না, যাতে টাইপ করতে বাধা না হয়
export function useShortcuts(onSearch: () => void) {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      const typing = !!t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable);
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        onSearch();
        return;
      }
      if (typing || e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.key === '/') {
        e.preventDefault();
        onSearch();
      } else if (e.key.toLowerCase() === 'n') {
        if (pathname === '/sales') window.dispatchEvent(new Event('tgz:new-sale'));
        else navigate('/sales?new=1');
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [navigate, pathname, onSearch]);
}
