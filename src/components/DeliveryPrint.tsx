import type { Sale } from '../types';
import { BDT } from './ui';
import { SHOP } from './InvoicePrint';

// দিনের ডেলিভারি তালিকা — রাইডার বা কুরিয়ারকে দেওয়ার কাগজ। স্ক্রিনে লুকানো, প্রিন্টে A4 landscape।
export function DeliveryPrint({ sales }: { sales: Sale[] | null }) {
  if (!sales || sales.length === 0) return null;
  const cod = sales.reduce((t, s) => t + (s.codAmount || 0), 0);
  const today = new Date().toLocaleDateString('bn-BD', { dateStyle: 'long' });
  return (
    <div className="print-area delivery-print" aria-hidden="true">
      <div className="flex items-start justify-between gap-4 border-b-4 border-[#3CC08A] pb-2">
        <div>
          <div className="text-base font-bold text-[#0E3B2C]">{SHOP.name} · ডেলিভারি তালিকা</div>
          <div className="text-xs">{SHOP.address} · যোগাযোগ: {SHOP.phone}</div>
        </div>
        <div className="text-right text-xs">
          <div>প্রিন্টের তারিখ: {today}</div>
          <div className="font-bold">মোট {sales.length}টি · COD {BDT(cod)}</div>
        </div>
      </div>

      <table className="mt-2 w-full border-collapse text-xs">
        <thead>
          <tr className="border-b border-black text-left">
            <th className="py-1">#</th>
            <th className="py-1">ইনভয়েস</th>
            <th className="py-1">কাস্টমার</th>
            <th className="py-1">ফোন</th>
            <th className="py-1">ঠিকানা</th>
            <th className="py-1">পণ্য</th>
            <th className="py-1 text-right">COD</th>
            <th className="py-1">ডেলিভারি নোট</th>
          </tr>
        </thead>
        <tbody>
          {sales.map((s, i) => (
            <tr key={s.id} className="border-b border-slate-400 align-top">
              <td className="py-1.5">{i + 1}</td>
              <td className="py-1.5 font-mono">{s.invoice || '—'}</td>
              <td className="py-1.5 font-semibold">{s.customerRef || '—'}</td>
              <td className="py-1.5 tabular-nums">{s.customerPhone || '—'}</td>
              <td className="py-1.5">{[s.customerAddress, s.courierArea].filter(Boolean).join(', ') || '—'}</td>
              <td className="py-1.5">{s.items?.length ? s.items.map(it => `${it.model || it.productName}${it.color ? ` (${it.color})` : ''}${it.quantity > 1 ? ` ×${it.quantity}` : ''}`).join(', ') : s.model || '—'}</td>
              <td className="py-1.5 text-right font-semibold tabular-nums">{BDT(s.codAmount || 0)}</td>
              <td className="w-28 py-1.5"></td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="font-bold">
            <td colSpan={6} className="py-2 text-right">মোট COD</td>
            <td className="py-2 text-right tabular-nums">{BDT(cod)}</td>
            <td></td>
          </tr>
        </tfoot>
      </table>
      <div className="mt-6 flex justify-between text-xs">
        <span>রাইডারের স্বাক্ষর: ____________________</span>
        <span>মালিকের স্বাক্ষর: ____________________</span>
      </div>
    </div>
  );
}
