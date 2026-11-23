import { useEffect, useState } from 'react';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import type { Goals } from '../types';

const ref = () => doc(db, 'settings', 'goals');

// মাসিক লক্ষ্য — লাইভ। কোনো লক্ষ্য না থাকলে null।
export function useGoals() {
  const [goals, setGoals] = useState<Goals | null>(null);
  const [loaded, setLoaded] = useState(false);
  useEffect(() => onSnapshot(ref(), snap => {
    const d = snap.data() as Partial<Goals> | undefined;
    setGoals(d && (d.sales || d.profit) ? { sales: Number(d.sales) || 0, profit: Number(d.profit) || 0 } : null);
    setLoaded(true);
  }, () => setLoaded(true)), []);
  return { goals, loaded };
}

export const saveGoals = (g: Goals) => setDoc(ref(), g, { merge: true });
