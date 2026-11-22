// সেলস, খরচ ও প্রোডাক্ট — লাইভ (onSnapshot)। কোনো পেজে বা অন্য ডিভাইসে বদল হলে সাথে সাথে দেখা যায়।
import { useEffect, useState } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import type { Expense, Product, Sale } from '../types';

export function useBusinessData() {
  const [sales, setSales] = useState<Sale[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const byTime = <T extends { timestamp?: number }>(docs: { id: string; data: () => object }[]) =>
      docs
        .map(d => ({ id: d.id, ...d.data() }) as unknown as T)
        .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
    const fail = (err: unknown) => { setError(String(err)); setLoading(false); };

    const unsubS = onSnapshot(collection(db, 'sales'), snap => {
      setSales(byTime<Sale>(snap.docs));
      setError(null);
      setLoading(false);
    }, fail);
    const unsubE = onSnapshot(collection(db, 'expenses'), snap => {
      setExpenses(byTime<Expense>(snap.docs));
    }, fail);
    const unsubP = onSnapshot(collection(db, 'products'), snap => {
      setProducts(snap.docs.map(d => ({ id: d.id, ...d.data() }) as Product));
    }, fail);

    return () => { unsubS(); unsubE(); unsubP(); };
  }, []);

  // আগের API বজায় রাখা — লাইভ হওয়ায় এখন আর আলাদা রিলোড দরকার নেই
  const reload = async () => {};

  return { sales, expenses, products, loading, error, reload };
}
