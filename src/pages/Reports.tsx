import { useEffect, useState } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import type { Sale, Expense } from '../types';

type ReportMode = 'daily' | 'monthly';

export default function Reports() {
  const [sales, setSales] = useState<Sale[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<ReportMode>('daily');
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().substring(0, 7));

  useEffect(() => {
    const load = async () => {
      const [salesSnap, expSnap] = await Promise.all([
        getDocs(collection(db, 'sales')),
        getDocs(collection(db, 'expenses')),
      ]);
      setSales(salesSnap.docs.map(d => ({ id: d.id, ...d.data() })) as Sale[]);
      setExpenses(expSnap.docs.map(d => ({ id: d.id, ...d.data() })) as Expense[]);
      setLoading(false);
    };
    load();
  }, []);

  const filterKey = mode === 'daily' ? selectedDate : selectedMonth;
  const filteredSales = sales.filter(s =>
    mode === 'daily' ? s.date === filterKey : s.date?.startsWith(filterKey)
  );
  const filteredExpenses = expenses.filter(e =>
    mode === 'daily' ? e.date === filterKey : e.date?.startsWith(filterKey)
  );

  const totalRevenue = filteredSales.reduce((sum, s) => sum + (s.salesAmount || 0), 0);
  const totalProfit = filteredSales.reduce((sum, s) => sum + (s.netProfit || 0), 0);
  const totalExpenses = filteredExpenses.reduce((sum, e) => sum + (e.amount || 0), 0);
  const netIncome = totalProfit - totalExpenses;
  const courierSales = filteredSales.filter(s => s.saleType === 'Courier Sale');
  const directSales = filteredSales.filter(s => s.saleType !== 'Courier Sale');

  if (loading) return <div className="text-white text-center mt-20">লোড হচ্ছে...</div>;

  return (
    <div>
      <h1 className="text-2xl font-bold text-white mb-6">রিপোর্ট</h1>

      {/* Mode selector */}
      <div className="flex gap-3 mb-5">
        <button
          onClick={() => setMode('daily')}
          className={`px-5 py-2.5 rounded-lg font-medium text-sm transition-colors ${mode === 'daily' ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}`}
        >
          📅 দৈনিক রিপোর্ট
        </button>
        <button
          onClick={() => setMode('monthly')}
          className={`px-5 py-2.5 rounded-lg font-medium text-sm transition-colors ${mode === 'monthly' ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}`}
        >
          📆 মাসিক রিপোর্ট
        </button>
      </div>

      {/* Date picker */}
      <div className="mb-6">
        {mode === 'daily' ? (
          <input
            type="date"
            value={selectedDate}
            onChange={e => setSelectedDate(e.target.value)}
            className="bg-gray-700 text-white rounded-lg px-4 py-2.5 border border-gray-600 focus:border-blue-500 focus:outline-none"
          />
        ) : (
          <input
            type="month"
            value={selectedMonth}
            onChange={e => setSelectedMonth(e.target.value)}
            className="bg-gray-700 text-white rounded-lg px-4 py-2.5 border border-gray-600 focus:border-blue-500 focus:outline-none"
          />
        )}
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-green-900/50 border border-green-700 rounded-xl p-4">
          <div className="text-green-400 text-xs mb-1">মোট বিক্রয়</div>
          <div className="text-white font-bold text-xl">৳{totalRevenue.toLocaleString()}</div>
          <div className="text-green-400 text-xs">{filteredSales.length}টি অর্ডার</div>
        </div>
        <div className="bg-blue-900/50 border border-blue-700 rounded-xl p-4">
          <div className="text-blue-400 text-xs mb-1">মোট মুনাফা</div>
          <div className="text-white font-bold text-xl">৳{totalProfit.toLocaleString()}</div>
          <div className="text-blue-400 text-xs">বিক্রয় থেকে</div>
        </div>
        <div className="bg-red-900/50 border border-red-700 rounded-xl p-4">
          <div className="text-red-400 text-xs mb-1">মোট খরচ</div>
          <div className="text-white font-bold text-xl">৳{totalExpenses.toLocaleString()}</div>
          <div className="text-red-400 text-xs">{filteredExpenses.length}টি এন্ট্রি</div>
        </div>
        <div className={`${netIncome >= 0 ? 'bg-emerald-900/50 border-emerald-700' : 'bg-orange-900/50 border-orange-700'} border rounded-xl p-4`}>
          <div className={`${netIncome >= 0 ? 'text-emerald-400' : 'text-orange-400'} text-xs mb-1`}>নেট আয়</div>
          <div className="text-white font-bold text-xl">৳{netIncome.toLocaleString()}</div>
          <div className={`${netIncome >= 0 ? 'text-emerald-400' : 'text-orange-400'} text-xs`}>
            {netIncome >= 0 ? 'লাভ' : 'লোকসান'}
          </div>
        </div>
      </div>

      {/* Sales breakdown */}
      <div className="grid md:grid-cols-2 gap-4 mb-6">
        <div className="bg-gray-800 rounded-xl p-4">
          <h3 className="text-white font-semibold mb-3">🛵 কুরিয়ার সেলস ({courierSales.length}টি)</h3>
          <div className="text-2xl font-bold text-green-400">
            ৳{courierSales.reduce((s, x) => s + (x.salesAmount || 0), 0).toLocaleString()}
          </div>
          <div className="text-sm text-gray-400 mt-1">
            COD: ৳{courierSales.reduce((s, x) => s + (x.codAmount || 0), 0).toLocaleString()}
          </div>
        </div>
        <div className="bg-gray-800 rounded-xl p-4">
          <h3 className="text-white font-semibold mb-3">🏪 সরাসরি বিক্রয় ({directSales.length}টি)</h3>
          <div className="text-2xl font-bold text-blue-400">
            ৳{directSales.reduce((s, x) => s + (x.salesAmount || 0), 0).toLocaleString()}
          </div>
        </div>
      </div>

      {/* Expense breakdown */}
      {filteredExpenses.length > 0 && (
        <div className="bg-gray-800 rounded-xl p-4">
          <h3 className="text-white font-semibold mb-3">💸 খরচের বিবরণ</h3>
          <div className="space-y-2">
            {filteredExpenses.map(e => (
              <div key={e.id} className="flex justify-between text-sm">
                <span className="text-gray-300">{e.description} <span className="text-gray-500">({e.category})</span></span>
                <span className="text-red-400">৳{(e.amount || 0).toLocaleString()}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {filteredSales.length === 0 && filteredExpenses.length === 0 && (
        <div className="text-center text-gray-500 mt-10">এই সময়কালে কোনো ডেটা নেই</div>
      )}
    </div>
  );
}
