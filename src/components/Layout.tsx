import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../AuthContext';

const navItems = [
  { to: '/', label: 'ড্যাশবোর্ড', short: 'হোম', icon: '📊' },
  { to: '/sales', label: 'সেলস ও কুরিয়ার', short: 'সেলস', icon: '🛵' },
  { to: '/products', label: 'প্রোডাক্ট ও স্টক', short: 'স্টক', icon: '📦' },
  { to: '/expenses', label: 'খরচ', short: 'খরচ', icon: '💸' },
  { to: '/reports', label: 'রিপোর্ট', short: 'রিপোর্ট', icon: '📅' },
];

export default function Layout({ children }: { children: React.ReactNode }) {
  const { logout, user } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen text-slate-900">
      {/* Top bar — মোবাইলে ছোট, ল্যাপটপে নেভিগেশন সহ */}
      <header
        className="fixed inset-x-0 top-0 z-50 border-b border-white/10 text-white shadow-[0_12px_30px_-14px_rgba(6,78,59,0.7)]"
        style={{ background: 'linear-gradient(90deg,#052e21 0%,#0b4a35 50%,#14532d 100%)' }}
      >
        <div className="mx-auto flex h-14 max-w-7xl items-center gap-3 px-3 sm:px-4 md:h-16">
          <div className="flex shrink-0 items-center rounded-lg bg-white px-2 py-1 shadow-sm">
            <img src="/logo.png" alt="Taqwa Gadget Zone" className="h-8 w-auto md:h-10" />
          </div>

          {/* Laptop/tablet navigation */}
          <nav className="hidden min-w-0 flex-1 items-center gap-1 md:flex">
            {navItems.map(item => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/'}
                className={({ isActive }) =>
                  `flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition ${
                    isActive ? 'bg-white/15 text-white' : 'text-emerald-200 hover:bg-white/10 hover:text-white'
                  }`
                }
              >
                <span>{item.icon}</span>
                <span>{item.label}</span>
              </NavLink>
            ))}
          </nav>

          <div className="ml-auto flex shrink-0 items-center gap-3">
            <span className="hidden text-xs text-emerald-200 xl:inline">{user?.email}</span>
            <button
              type="button"
              onClick={handleLogout}
              className="rounded-lg border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-medium text-emerald-50 transition hover:bg-white/20"
            >
              লগআউট
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-3 pb-28 pt-16 sm:px-4 md:pb-10 md:pt-20">
        {children}
      </main>

      {/* Mobile bottom tabs — এক হাতে সহজে ব্যবহারের জন্য */}
      <nav
        className="fixed inset-x-0 bottom-0 z-50 border-t border-emerald-100 bg-white/95 shadow-[0_-10px_30px_-16px_rgba(6,78,59,0.4)] backdrop-blur md:hidden"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <div className="mx-auto grid max-w-md grid-cols-5">
          {navItems.map(item => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) =>
                `flex flex-col items-center gap-0.5 py-2 text-[11px] font-medium transition ${
                  isActive ? 'text-emerald-800' : 'text-slate-500'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <span
                    className={`flex h-7 w-12 items-center justify-center rounded-full text-base transition ${
                      isActive ? 'bg-emerald-100' : ''
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
    </div>
  );
}
