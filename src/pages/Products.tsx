import { useEffect, useState } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import type { Product } from '../types';

const STATUS_COLORS: Record<string, string> = {
  'IN STOCK': 'bg-green-900 text-green-300',
  'LOW STOCK': 'bg-yellow-900 text-yellow-300',
  'OUT OF STOCK': 'bg-red-900 text-red-300',
};

export default function Products() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');

  const load = async () => {
    setLoading(true);
    const snap = await getDocs(collection(db, 'products'));
    const data = snap.docs.map(d => ({ id: d.id, ...d.data() })) as Product[];
    data.sort((a, b) => a.name.localeCompare(b.name));
    setProducts(data);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const categories = [...new Set(products.map(p => p.category))].sort();
  const filtered = products.filter(p => {
    const matchSearch = p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.model?.toLowerCase().includes(search.toLowerCase());
    const matchCat = !category || p.category === category;
    return matchSearch && matchCat;
  });

  const totalValue = filtered.reduce((sum, p) => sum + (p.stockValue || 0), 0);

  if (loading) return <div className="text-white text-center mt-20">লোড হচ্ছে...</div>;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-white">প্রডাক্ট স্টক</h1>
        <div className="text-sm text-gray-400">মোট মূল্য: <span className="text-blue-400 font-semibold">৳{totalValue.toLocaleString()}</span></div>
      </div>

      <div className="flex gap-3 mb-5">
        <input
          type="text"
          placeholder="প্রডাক্ট খুঁজুন..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="flex-1 bg-gray-700 text-white rounded-lg px-4 py-2.5 border border-gray-600 focus:border-blue-500 focus:outline-none text-sm"
        />
        <select
          value={category}
          onChange={e => setCategory(e.target.value)}
          className="bg-gray-700 text-white rounded-lg px-4 py-2.5 border border-gray-600 focus:border-blue-500 focus:outline-none text-sm"
        >
          <option value="">সব ক্যাটাগরি</option>
          {categories.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      <div className="grid gap-3">
        {filtered.map(product => (
          <div key={product.id} className="bg-gray-800 rounded-xl p-4">
            <div className="flex items-start justify-between mb-3">
              <div>
                <h3 className="text-white font-semibold">{product.name}</h3>
                <div className="text-gray-400 text-sm">{product.category} · {product.model}</div>
              </div>
              <div className="text-right">
                <span className={`text-xs px-2 py-1 rounded-full font-medium ${STATUS_COLORS[product.status] || 'bg-gray-700 text-gray-300'}`}>
                  {product.status}
                </span>
                <div className="text-blue-400 font-semibold mt-1">৳{(product.stockValue || 0).toLocaleString()}</div>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2 text-sm mb-3">
              <div className="bg-gray-700/50 rounded-lg p-2 text-center">
                <div className="text-gray-400 text-xs">বর্তমান স্টক</div>
                <div className="text-white font-bold">{product.currentStock}</div>
              </div>
              <div className="bg-gray-700/50 rounded-lg p-2 text-center">
                <div className="text-gray-400 text-xs">বিক্রিত</div>
                <div className="text-green-400 font-bold">{product.totalSold}</div>
              </div>
              <div className="bg-gray-700/50 rounded-lg p-2 text-center">
                <div className="text-gray-400 text-xs">ক্রয় মূল্য</div>
                <div className="text-yellow-400 font-bold">৳{product.defaultPurchasePrice}</div>
              </div>
            </div>

            {/* Color breakdown */}
            {product.colors && product.colors.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {product.colors.map(color => (
                  <div key={color} className="bg-gray-700 rounded-lg px-3 py-1 text-xs">
                    <span className="text-gray-400">{color}: </span>
                    <span className="text-white font-semibold">{product.colorStock?.[color] ?? 0}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="text-center text-gray-500 mt-10">কোনো প্রডাক্ট পাওয়া যায়নি</div>
      )}
    </div>
  );
}
