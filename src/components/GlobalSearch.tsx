import { useEffect, useMemo, useState } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { useNavigate } from 'react-router-dom';
import { db } from '../firebase';
import type { Product, Sale } from '../types';
import { Modal, inputCls, Badge } from './ui';

const STATUS_BN: Record<string, string> = {
  pending: 'পেন্ডিং', in_review: 'রিভিউতে', delivered: 'ডেলিভারি', cancelled: 'বাতিল',
  hold: 'হোল্ড', returned_to_merchant: 'ফেরত এসেছে', returned_to_courier: 'কুরিয়ারে ফেরত',
  in_transit: 'পথে আছে', processing: 'প্রসেসিং', picked_up: 'পিকআপ হয়েছে',
};

// সব সেল ও প্রোডাক্টে এক জায়গা থেকে খোঁজ — ইনভয়েস, নাম, ফোন, ট্র্যাকিং কোড, মডেল
export function GlobalSearch({ open, onClose }: { open: boolean; onClose: () => void }) {
  const navigate = useNavigate();
  const [q, setQ] = useState('');
  const [sales, setSales] = useState<Sale[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [busy, setBusy] = useState(false);

  // খোলার সময় একবার তাজা ডেটা আনা (সেভ-করা নতুন সেলও যেন পাওয়া যায়)
  useEffect(() => {
    if (!open) return;
    let alive = true;
    setBusy(true);
    Promise.all([getDocs(collection(db, 'sales')), getDocs(collection(db, 'products'))])
      .then(([sSnap, pSnap]) => {
        if (!alive) return;
        setSales(sSnap.docs.map(d => ({ id: d.id, ...d.data() }) as Sale));
        setProducts(pSnap.docs.map(d => ({ id: d.id, ...d.data() }) as Product));
      })
      .catch(() => {})
      .finally(() => alive && setBusy(false));
    return () => { alive = false; };
  }, [open]);

  const query = q.trim().toLowerCase();
  const digits = q.replace(/\D/g, '');

  const saleHits = useMemo(() => {
    if (!query) return [];
    return sales.filter(s => {
      const hay = [
        s.invoice, s.orderNumber, s.customerRef, s.courierTrackingCode, s.courierInvoice,
        s.model, ...(s.items || []).map(i => `${i.model} ${i.productName}`),
      ].map(v => (v || '').toLowerCase()).join(' ');
      return hay.includes(query) || (digits.length >= 4 && (s.customerPhone || '').replace(/\D/g, '').includes(digits));
    }).sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0)).slice(0, 12);
  }, [sales, query, digits]);

  const productHits = useMemo(() => {
    if (!query) return [];
    return products.filter(p =>
      [p.name, p.model, p.category].some(v => (v || '').toLowerCase().includes(query))
    ).slice(0, 6);
  }, [products, query]);

  const close = () => { setQ(''); onClose(); };

  // Esc দিয়ে বন্ধ
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);
  const goSale = (s: Sale) => {
    navigate(`/sales?q=${encodeURIComponent(s.invoice || s.customerPhone || s.customerRef || '')}`);
    close();
  };
  const goProduct = () => { navigate('/products'); close(); };

  return (
    <Modal open={open} title="দ্রুত খোঁজ" onClose={close}>
      <input autoFocus type="search" value={q} onChange={e => setQ(e.target.value)}
        placeholder="ইনভয়েস, নাম, ফোন, ট্র্যাকিং কোড বা প্রোডাক্ট লিখুন…"
        onKeyDown={e => { if (e.key === 'Enter' && saleHits[0]) goSale(saleHits[0]); }}
        className={inputCls} />
      <div className="mt-2 text-xs text-slate-400">Enter = প্রথম ফলাফল খুলুন · Esc = বন্ধ</div>

      {!query ? (
        <div className="py-10 text-center text-sm text-slate-400">{busy ? 'ডেটা আনা হচ্ছে…' : 'খোঁজা শুরু করতে লিখুন'}</div>
      ) : (
        <div className="mt-4 space-y-5">
          <section>
            <div className="mb-2 text-xs font-semibold text-slate-500">সেল ({saleHits.length})</div>
            {saleHits.length === 0 ? <div className="text-sm text-slate-400">কোনো সেল মেলেনি</div> : (
              <ul className="divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200">
                {saleHits.map(s => (
                  <li key={s.id}>
                    <button type="button" onClick={() => goSale(s)}
                      className="flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left hover:bg-[#EEF8F3]">
                      <div className="min-w-0">
                        <div className="font-mono text-xs font-semibold text-emerald-900">{s.invoice || '—'} <span className="font-normal text-slate-400">· {s.date}</span></div>
                        <div className="truncate text-sm font-medium text-slate-900">{s.customerRef || 'সরাসরি বিক্রয়'} {s.customerPhone && <span className="text-xs font-normal text-slate-500">· {s.customerPhone}</span>}</div>
                      </div>
                      {s.courierDeliveryStatus && <Badge tone="slate">{STATUS_BN[s.courierDeliveryStatus] || s.courierDeliveryStatus}</Badge>}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section>
            <div className="mb-2 text-xs font-semibold text-slate-500">প্রোডাক্ট ({productHits.length})</div>
            {productHits.length === 0 ? <div className="text-sm text-slate-400">কোনো প্রোডাক্ট মেলেনি</div> : (
              <ul className="divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200">
                {productHits.map(p => (
                  <li key={p.id}>
                    <button type="button" onClick={goProduct}
                      className="flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left hover:bg-[#EEF8F3]">
                      <span className="truncate text-sm font-medium text-slate-900">{p.model || p.name}</span>
                      <span className="shrink-0 text-xs tabular-nums text-slate-500">স্টক {p.currentStock ?? 0}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      )}
    </Modal>
  );
}
