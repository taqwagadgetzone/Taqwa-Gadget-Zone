// সেলস, খরচ ও প্রোডাক্ট একসাথে লোড — ড্যাশবোর্ড ও রিপোর্ট একই ডেটা ব্যবহার করে
import { useCallback, useEffect, useState } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import type { Expense, Product, Sale } from '../types';

export function useBusinessData() {
  const [sales, setSales] = useState<Sale[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    try {
      const [s, e, p] = await Promise.all([
        getDocs(collection(db, 'sales')),
        getDocs(collection(db, 'expenses')),
        getDocs(collection(db, 'products')),
      ]);
      const sl = s.docs.map(d => ({ id: d.id, ...d.data() })) as Sale[];
      sl.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
      const ex = e.docs.map(d => ({ id: d.id, ...d.data() })) as Expense[];
      ex.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
      setSales(sl);
      setExpenses(ex);
      setProducts(p.docs.map(d => ({ id: d.id, ...d.data() })) as Product[]);
      setError(null);
    } catch (err) {
      setError(String(err));
    }
    setLoading(false);
  }, []);

  useEffect(() => { reload(); }, [reload]);

  return { sales, expenses, products, loading, error, reload };
}
