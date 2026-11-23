import { NavLink, useNavigate } from 'react-router-dom';
import { useCallback, useState } from 'react';
import { useAuth } from '../AuthContext';
import { useOnline } from '../hooks/useOnline';
import { useShortcuts } from '../hooks/useShortcuts';
import { GlobalSearch } from './GlobalSearch';

const navItems = [
  { to: '/', label: 'ড্যাশবোর্ড', short: 'হোম', icon: '📊' },
  { to: '/sales', label: 'সেলস ও কুরিয়ার', short: 'সেলস', icon: '🛵' },
  { to: '/products', label: 'প্রোডাক্ট ও স্টক', short: 'স্টক', icon: '📦' },
  { to: '/expenses', label: 'খরচ', short: 'খরচ', icon: '💸' },
  { to: '/ledger', label: 'খাতা', short: 'খাতা', icon: '📒' },
  { to: '/reports', label: 'রিপোর্ট', short: 'রিপোর্ট', icon: '📅' },
];

export default function Layout({ children }: { children: React.ReactNode }) {
  const { logout, user } = useAuth();
  const navigate = useNavigate();
  const online = useOnline();
  const [searchOpen, setSearchOpen] = useState(false);
  const openSearch = useCallback(() => setSearchOpen(true), []);
  useShortcuts(openSearch);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen text-slate-900">
      {/* উপরের হেডার: লোগো · নেভিগেশন · অবস্থা ও অ্যাকশন */}
      <header className="app-header fixed inset-x-0 top-0 z-50 h-16 text-white shadow-[0_16px_36px_-18px_rgba(10,48,38,0.8)] lg:h-[72px]">
        <div className="circuit-bg pointer-events-none absolute inset-0 opacity-80" />
        <div className="relative mx-auto flex h-full max-w-7xl items-center gap-3 px-3 sm:px-5">
          {/* লোগো-ব্যাজ */}
          <div className="flex shrink-0 items-center gap-3">
            <div className="flex items-center rounded-2xl bg-white px-2.5 py-1.5 shadow-[0_0_0_3px_rgba(60,192,138,0.35)]">
              <img src="/logo.png" alt="Taqwa Gadget Zone" className="h-9 w-auto lg:h-11" />
            </div>
            <div className="hidden leading-tight 2xl:block">
              <div className="font-display text-base font-bold tracking-wide">Taqwa Stock</div>
              <div className="text-xs text-[#9BE7C4]">ব্যবসার হিসাব</div>
            </div>
          </div>

          {/* ডেস্কটপ নেভিগেশন — একটি গোলাকার সেগমেন্ট */}
          <nav className="hidden min-w-0 flex-1 justify-center lg:flex">
            <div className="flex items-center gap-1 rounded-2xl bg-black/25 p-1 ring-1 ring-white/10">
              {navItems.map(item => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.to === '/'}
                  className={({ isActive }) =>
                    `flex items-center gap-2 rounded-xl px-3.5 py-2 text-sm font-semibold transition ${
                      isActive
                        ? 'bg-[#E9FAF2] text-[#0E3B2C] shadow-[0_6px_16px_-8px_rgba(0,0,0,0.5)]'
                        : 'text-[#CBEBDD]/85 hover:bg-white/10 hover:text-white'
                    }`
                  }
                >
                  <span>{item.icon}</span>
                  <span>{item.label}</span>
                </NavLink>
              ))}
            </div>
          </nav>

          <div className="ml-auto flex shrink-0 items-center gap-2">
            {/* সংযোগের অবস্থা */}
            <span className="flex items-center gap-2 rounded-full bg-black/25 px-2.5 py-1.5 ring-1 ring-white/10" title={online ? 'ইন্টারনেট সংযুক্ত' : 'ইন্টারনেট নেই'}>
              <span className={online
                ? 'h-2 w-2 rounded-full bg-[#5EE3A6] shadow-[0_0_0_4px_rgba(94,227,166,0.18)]'
                : 'h-2 w-2 rounded-full bg-amber-300 shadow-[0_0_0_4px_rgba(252,211,77,0.18)]'} />
              <span className="hidden text-xs font-medium text-white/85 2xl:inline">{online ? 'লাইভ' : 'অফলাইন'}</span>
            </span>
            <button
              type="button"
              onClick={openSearch}
              title="দ্রুত খোঁজ (/ বা Ctrl+K)"
              aria-label="দ্রুত খোঁজ"
              className="flex h-9 items-center gap-2 rounded-xl bg-white/10 px-2.5 text-xs font-medium text-white ring-1 ring-white/15 transition hover:bg-white/20"
            >
              <span>🔍</span>
              <span className="hidden xl:inline">খুঁজুন</span>
              <kbd className="hidden rounded bg-white/15 px-1.5 text-[11px] xl:inline">/</kbd>
            </button>
            <span className="hidden text-xs text-white/65 xl:inline">{user?.email}</span>
            <button
              type="button"
              onClick={handleLogout}
              className="rounded-xl bg-white/10 px-3 py-2 text-xs font-semibold text-white ring-1 ring-white/15 transition hover:bg-white/20"
            >
              লগআউট
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-3 pb-28 pt-[84px] sm:px-5 lg:pb-12 lg:pt-[90px]">
        {!online && (
          <div role="status" className="mb-4 rounded-2xl border border-[#CBE59E] bg-amber-50 px-4 py-3 text-sm text-amber-900">
            📴 ইন্টারনেট নেই। আগের হিসাব দেখা যাবে, কিন্তু সেভ, মোছা ও স্ট্যাটাস বদল নেট এলে করুন।
          </div>
        )}
        {children}
      </main>

      {/* মোবাইল/ট্যাবলেটের নিচের ট্যাব — এক হাতে সহজে ব্যবহারের জন্য */}
      <nav
        className="fixed inset-x-0 bottom-0 z-50 border-t border-[#CFE6DA] bg-white/95 shadow-[0_-12px_32px_-18px_rgba(10,48,38,0.55)] backdrop-blur lg:hidden"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <div className="mx-auto grid max-w-md grid-cols-6">
          {navItems.map(item => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) =>
                `flex flex-col items-center gap-0.5 py-2 text-xs font-semibold transition ${
                  isActive ? 'text-[#0E3B2C]' : 'text-slate-500'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <span
                    className={`flex h-8 w-12 items-center justify-center rounded-2xl text-lg transition ${
                      isActive ? 'bg-[#D5F0E3] shadow-inner' : ''
                    }`}
                  >
                    {item.icon}
                  </span>
                  <span>{item.short}</span>
                </>
              )}
            </NavLink>
          ))}
        </div>
      </nav>

      <GlobalSearch open={searchOpen} onClose={() => setSearchOpen(false)} />
    </div>
  );
}
