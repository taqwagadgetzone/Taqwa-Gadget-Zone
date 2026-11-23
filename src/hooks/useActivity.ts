import { useEffect, useState } from 'react';
import { collection, limit, onSnapshot, orderBy, query } from 'firebase/firestore';
import { db } from '../firebase';
import type { ActivityKind } from '../services/activity';

export interface ActivityEntry {
  id: string;
  kind: ActivityKind;
  action: string;
  detail: string;
  by: string;
  timestamp: number;
}

// সর্বশেষ ৫০টি কার্যক্রম — লাইভ
export function useActivity() {
  const [items, setItems] = useState<ActivityEntry[]>([]);
  useEffect(() => {
    const q = query(collection(db, 'activity'), orderBy('timestamp', 'desc'), limit(50));
    return onSnapshot(q, snap => {
      setItems(snap.docs.map(d => ({ id: d.id, ...d.data() }) as ActivityEntry));
    }, () => setItems([]));
  }, []);
  return items;
}
