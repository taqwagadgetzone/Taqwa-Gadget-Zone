import { useEffect, useState } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import type { Sale } from '../types';

const DELIVERY_STATUS: Record<string, { label: string; color: string }> = {
  'in_review': { label: 'রিভিউতে', color: 'bg-blue-900 text-blue-300' },
  'pending': { label: 'পেন্ডিং', color: 'bg-yellow-900 text-yellow-300' },
  'delivered_approval_pending': { label: 'ডেলিভারি অপেক্ষায়', color: 'bg-orange-900 text-orange-300' },
  'partial_delivered': { label: 'আংশিক ডেলিভারি', color: 'bg-purple-900 text-purple-300' },
  'delivered': { label: 'ডেলিভারি হয়েছে', color: 'bg-green-900 text-green-300' },
  'cancelled': { label: 'বাতিল', color: 'bg-red-900 text-red-300' },
  'hold': { label: 'হোল্ড', color: 'bg-gray-700 text-gray-300' },
};

export default function Sales() {
  const [sales, setSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [dateFilter, setDateFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  useEffect(() => {
    const load = async () => {
      const snap = await getDocs(collection(db, 'sales'));
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() })) as Sale[];
      data.sort((a, b) => b.timestamp - a.timestamp);
      setSales(data);
      setLoading(false);
    };
    load();
  }, []);

  const filtered = sales.filter(s => {
    const matchSearch = !search ||
      s.customerRef?.toLowerCase().includes(search.toLowerCase()) ||
      s.customerPhone?.includes(search) ||
      s.courierTrackingCode?.toLowerCase().includes(search.toLowerCase()) ||
      s.model?.toLowerCase().includes(search.toLowerCase());
    const matchDate = !dateFilter || s.date === dateFilter;
    const matchStatus = !statusFilter || s.courierDeliveryStatus === statusFilter;
    return matchSearch && matchDate && matchStatus;
  });

  const totalRevenue = filtered.reduce((sum, s) => sum + (s.salesAmount || 0), 0);
  const totalProfit = filtered.reduce((sum, s) => sum + (s.netProfit || 0), 0);

  if (loading) return <div className="text-white text-center mt-20">লোড হচ্ছে...</div>;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-white">সেলস ও কুরিয়ার</h1>
        <div className="text-sm text-gray-400">
          বিক্রয়: <span className="text-green-400 font-semibold">৳{totalRevenue.toLocaleString()}</span>
          {' · '}মুনাফা: <span className="text-blue-400 font-semibold">৳{totalProfit.toLocaleString()}</span>
        </div>
      </div>

      <div className="flex gap-3 mb-5 flex-wrap">
        <input
          type="text"
          placeholder="কাস্টমার / ট্র্যাকিং / প্রডাক্ট..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="flex-1 min-w-48 bg-gray-700 text-white rounded-lg px-4 py-2.5 border border-gray-600 focus:border-blue-500 focus:outline-none text-sm"
        />
        <input
          type="date"
          value={dateFilter}
          onChange={e => setDateFilter(e.target.value)}
          className="bg-gray-700 text-white rounded-lg px-4 py-2.5 border border-gray-600 focus:border-blue-500 focus:outline-none text-sm"
        />
        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
          className="bg-gray-700 text-white rounded-lg px-4 py-2.5 border border-gray-600 focus:border-blue-500 focus:outline-none text-sm"
        >
          <option value="">সব স্ট্যাটাস</option>
          {Object.entries(DELIVERY_STATUS).map(([key, val]) => (
            <option key={key} value={key}>{val.label}</option>
          ))}
        </select>
      </div>

      <div className="space-y-3">
        {filtered.map(sale => {
          const status = sale.courierDeliveryStatus ? DELIVERY_STATUS[sale.courierDeliveryStatus] : null;
          return (
            <div key={sale.id} className="bg-gray-800 rounded-xl p-4">
              <div className="flex items-start justify-between mb-2">
                <div>
                  <div className="text-white font-semibold">{sale.customerRef || 'সরাসরি বিক্রয়'}</div>
                  <div className="text-gray-400 text-sm">{sale.customerPhone} · {sale.date}</div>
                </div>
                <div className="text-right">
                  <div className="text-green-400 font-bold">৳{(sale.salesAmount || 0).toLocaleString()}</div>
                  <div className="text-blue-400 text-sm">মুনাফা: ৳{(sale.netProfit || 0).toLocaleString()}</div>
                </div>
              </div>

              <div className="text-gray-300 text-sm mb-2">{sale.model?.substring(0, 60)}</div>

              {sale.courierTrackingCode && (
                <div className="flex items-center justify-between bg-gray-700/50 rounded-lg px-3 py-2">
                  <div>
                    <div className="text-xs text-gray-400">ট্র্যাকিং কোড</div>
                    <div className="text-blue-300 text-sm font-mono">{sale.courierTrackingCode}</div>
                  </div>
                  {status && (
                    <span className={`text-xs px-2 py-1 rounded-full font-medium ${status.color}`}>
                      {status.label}
                    </span>
                  )}
                </div>
              )}

              {sale.customerAddress && (
                <div className="text-xs text-gray-500 mt-1">📍 {sale.customerAddress}</div>
              )}
            </div>
          );
        })}
      </div>

      {filtered.length === 0 && (
        <div className="text-center text-gray-500 mt-10">কোনো সেলস পাওয়া যায়নি</div>
      )}
    </div>
  );
}
