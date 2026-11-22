import { useEffect, useState } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import type { Expense } from '../types';

export default function Expenses() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateFilter, setDateFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');

  useEffect(() => {
    const load = async () => {
      const snap = await getDocs(collection(db, 'expenses'));
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() })) as Expense[];
      data.sort((a, b) => b.timestamp - a.timestamp);
      setExpenses(data);
      setLoading(false);
    };
    load();
  }, []);

  const categories = [...new Set(expenses.map(e => e.category))].sort();
  const filtered = expenses.filter(e => {
    const matchDate = !dateFilter || e.date === dateFilter;
    const matchCat = !categoryFilter || e.category === categoryFilter;
    return matchDate && matchCat;
  });

  const total = filtered.reduce((sum, e) => sum + (e.amount || 0), 0);

  if (loading) return <div className="text-white text-center mt-20">লোড হচ্ছে...</div>;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-white">খরচ</h1>
        <div className="text-sm text-gray-400">মোট: <span className="text-red-400 font-semibold">৳{total.toLocaleString()}</span></div>
      </div>

      <div className="flex gap-3 mb-5">
        <input
          type="date"
          value={dateFilter}
          onChange={e => setDateFilter(e.target.value)}
          className="bg-gray-700 text-white rounded-lg px-4 py-2.5 border border-gray-600 focus:border-blue-500 focus:outline-none text-sm"
        />
        <select
          value={categoryFilter}
          onChange={e => setCategoryFilter(e.target.value)}
          className="bg-gray-700 text-white rounded-lg px-4 py-2.5 border border-gray-600 focus:border-blue-500 focus:outline-none text-sm"
        >
          <option value="">সব ক্যাটাগরি</option>
          {categories.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      <div className="space-y-3">
        {filtered.map(expense => (
          <div key={expense.id} className="bg-gray-800 rounded-xl p-4 flex items-center justify-between">
            <div>
              <div className="text-white font-medium">{expense.description}</div>
              <div className="text-gray-400 text-sm">{expense.category} · {expense.date}</div>
              {expense.targetModel && (
                <div className="text-gray-500 text-xs">{expense.targetModel}</div>
              )}
              {expense.dollarAmount && (
                <div className="text-gray-500 text-xs">${expense.dollarAmount} @ ৳{expense.dollarRate}</div>
              )}
            </div>
            <div className="text-red-400 font-bold text-lg">৳{(expense.amount || 0).toLocaleString()}</div>
          </div>
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="text-center text-gray-500 mt-10">কোনো খরচ পাওয়া যায়নি</div>
      )}
    </div>
  );
}
