import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../AuthContext';

const navItems = [
  { to: '/', label: 'ড্যাশবোর্ড', icon: '📊' },
  { to: '/products', label: 'প্রডাক্ট স্টক', icon: '📦' },
  { to: '/sales', label: 'সেলস', icon: '🛵' },
  { to: '/expenses', label: 'খরচ', icon: '💸' },
  { to: '/reports', label: 'রিপোর্ট', icon: '📅' },
];

export default function Layout({ children }: { children: React.ReactNode }) {
  const { logout, user } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-gray-900 flex">
      {/* Sidebar */}
      <aside className="w-56 bg-gray-800 flex flex-col fixed h-full z-10">
        <div className="p-4 border-b border-gray-700">
          <div className="text-xl font-bold text-white">📦 TGZ</div>
          <div className="text-xs text-gray-400 mt-1 truncate">{user?.email}</div>
        </div>

        <nav className="flex-1 p-3 space-y-1">
          {navItems.map(item => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-300 hover:bg-gray-700 hover:text-white'
                }`
              }
            >
              <span>{item.icon}</span>
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="p-3 border-t border-gray-700">
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-gray-300 hover:bg-red-900/50 hover:text-red-300 transition-colors"
          >
            <span>🚪</span>
            <span>লগআউট</span>
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 ml-56 p-6 overflow-auto">
        {children}
      </main>
    </div>
  );
}
