import { useEffect, useState } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import type { Product, Sale, Expense } from '../types';

interface Stats {
  totalProducts: number;
  totalStockValue: number;
  todaySales: number;
  todayProfit: number;
  todayOrders: number;
  monthSales: number;
  monthProfit: number;
  monthOrders: number;
  lowStockCount: number;
  outOfStockCount: number;
}

export default function Dashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [recentSales, setRecentSales] = useState<Sale[]>([]);

  useEffect(() => {
    const load = async () => {
      try {
        const [productsSnap, salesSnap, expensesSnap] = await Promise.all([
          getDocs(collection(db, 'products')),
          getDocs(collection(db, 'sales')),
          getDocs(collection(db, 'expenses')),
        ]);

        const products = productsSnap.docs.map(d => ({ id: d.id, ...d.data() })) as Product[];
        const sales = salesSnap.docs.map(d => ({ id: d.id, ...d.data() })) as Sale[];
        expensesSnap.docs.map(d => ({ id: d.id, ...d.data() })) as Expense[];

        const today = new Date().toISOString().split('T')[0];
        const thisMonth = today.substring(0, 7);

        const todaySalesArr = sales.filter(s => s.date === today);
        const monthSalesArr = sales.filter(s => s.date?.startsWith(thisMonth));

        const recent = [...sales].sort((a, b) => b.timestamp - a.timestamp).slice(0, 5);
        setRecentSales(recent);

        setStats({
          totalProducts: products.length,
          totalStockValue: products.reduce((sum, p) => sum + (p.stockValue || 0), 0),
          todaySales: todaySalesArr.reduce((sum, s) => sum + (s.salesAmount || 0), 0),
          todayProfit: todaySalesArr.reduce((sum, s) => sum + (s.netProfit || 0), 0),
          todayOrders: todaySalesArr.length,
          monthSales: monthSalesArr.reduce((sum, s) => sum + (s.salesAmount || 0), 0),
          monthProfit: monthSalesArr.reduce((sum, s) => sum + (s.netProfit || 0), 0),
          monthOrders: monthSalesArr.length,
          lowStockCount: products.filter(p => p.status === 'LOW STOCK').length,
          outOfStockCount: products.filter(p => p.status === 'OUT OF STOCK').length,
        });
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  if (loading) return <div className="text-white text-center mt-20">লোড হচ্ছে...</div>;

  const cards = [
    { label: 'মোট স্টক মূল্য', value: `৳${stats?.totalStockValue?.toLocaleString()}`, icon: '💰', color: 'bg-blue-600' },
    { label: 'আজকের বিক্রয়', value: `৳${stats?.todaySales?.toLocaleString()}`, icon: '📈', color: 'bg-green-600' },
    { label: 'আজকের মুনাফা', value: `৳${stats?.todayProfit?.toLocaleString()}`, icon: '✅', color: 'bg-emerald-600' },
    { label: 'আজকের অর্ডার', value: `${stats?.todayOrders}টি`, icon: '🛵', color: 'bg-purple-600' },
    { label: 'মাসিক বিক্রয়', value: `৳${stats?.monthSales?.toLocaleString()}`, icon: '📅', color: 'bg-orange-600' },
    { label: 'মাসিক মুনাফা', value: `৳${stats?.monthProfit?.toLocaleString()}`, icon: '💎', color: 'bg-cyan-600' },
    { label: 'মোট প্রডাক্ট', value: `${stats?.totalProducts}টি`, icon: '📦', color: 'bg-indigo-600' },
    { label: 'কম স্টক', value: `${stats?.lowStockCount}টি`, icon: '⚠️', color: 'bg-yellow-600' },
  ];

  const statusColor: Record<string, string> = {
    'pending': 'bg-yellow-900 text-yellow-300',
    'in_review': 'bg-blue-900 text-blue-300',
    'delivered': 'bg-green-900 text-green-300',
    'cancelled': 'bg-red-900 text-red-300',
  };

  return (
    <div>
      <h1 className="text-2xl font-bold text-white mb-6">ড্যাশবোর্ড</h1>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {cards.map(card => (
          <div key={card.label} className={`${card.color} rounded-xl p-4 text-white`}>
            <div className="text-2xl mb-1">{card.icon}</div>
            <div className="text-xl font-bold">{card.value}</div>
            <div className="text-sm opacity-80">{card.label}</div>
          </div>
        ))}
      </div>

      <div className="bg-gray-800 rounded-xl p-5">
        <h2 className="text-lg font-semibold text-white mb-4">সাম্প্রতিক অর্ডার</h2>
        <div className="space-y-3">
          {recentSales.map(sale => (
            <div key={sale.id} className="flex items-center justify-between bg-gray-700/50 rounded-lg px-4 py-3">
              <div>
                <div className="text-white font-medium text-sm">{sale.customerRef || 'সরাসরি বিক্রয়'}</div>
                <div className="text-gray-400 text-xs">{sale.date} · {sale.model?.substring(0, 40)}</div>
              </div>
              <div className="text-right">
                <div className="text-green-400 font-semibold">৳{sale.salesAmount?.toLocaleString()}</div>
                {sale.courierDeliveryStatus && (
                  <span className={`text-xs px-2 py-0.5 rounded-full ${statusColor[sale.courierDeliveryStatus] || 'bg-gray-600 text-gray-300'}`}>
                    {sale.courierDeliveryStatus}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
