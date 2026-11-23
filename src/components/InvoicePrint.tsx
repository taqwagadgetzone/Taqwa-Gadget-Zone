import type { Sale } from '../types';
import { BDT } from './ui';

// দোকানের তথ্য — ফোন ও ঠিকানা এখানে বসালে ইনভয়েসের উপরে দেখাবে
export const SHOP = {
  name: 'Taqwa Gadget Zone',
  phone: '01812342640',
  address: 'কোর্ট স্টেশন পিডিবি, রাজশাহী কোর্ট, রাজশাহী',
};

// প্রিন্টের জন্য ইনভয়েস। স্ক্রিনে লুকানো থাকে; প্রিন্টের সময় index.css অনুযায়ী একাই দেখায়।
// কুরিয়ার ইনভয়েস এখানে দেখানো হয় না — শুধু আমাদের TGZ ইনভয়েস যায়।
export function InvoicePrint({ sale }: { sale: Sale | null }) {
  if (!sale) return null;
  const items = sale.items || [];
  const advance = sale.advanceAmount || 0;
  const total = sale.salesAmount || items.reduce((s, i) => s + (i.totalSelling || 0), 0);
  const due = Math.max(0, total - advance);
  return (
    <div className="print-area" aria-hidden="true">
      <div className="flex items-start justify-between gap-4 border-b-4 border-[#F26B1D] pb-3">
        <div className="flex items-center gap-3">
          <img src="/logo.png" alt="" className="h-14 w-auto" />
          <div>
            <div className="text-lg font-bold text-[#0E3B2C]">{SHOP.name}</div>
            {SHOP.address && <div className="text-xs">{SHOP.address}</div>}
            {SHOP.phone && <div className="text-xs">যোগাযোগ: {SHOP.phone}</div>}
          </div>
        </div>
        <div className="text-right text-sm">
          <div className="font-mono text-base font-bold">{sale.invoice || '—'}</div>
          <div>তারিখ: {sale.date}</div>
        </div>
      </div>

      <div className="mt-3 text-sm">
        <div><span className="font-semibold">কাস্টমার:</span> {sale.customerRef || '—'}</div>
        {sale.customerPhone && <div><span className="font-semibold">ফোন:</span> {sale.customerPhone}</div>}
        {sale.customerAddress && <div><span className="font-semibold">ঠিকানা:</span> {sale.customerAddress}</div>}
      </div>

      <table className="mt-3 w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-black text-left">
            <th className="py-1.5">#</th>
            <th className="py-1.5">প্রোডাক্ট</th>
            <th className="py-1.5">কালার</th>
            <th className="py-1.5 text-right">পরিমাণ</th>
            <th className="py-1.5 text-right">দাম</th>
            <th className="py-1.5 text-right">মোট</th>
          </tr>
        </thead>
        <tbody>
          {items.map((it, i) => (
            <tr key={it.id || i} className="border-b border-slate-300">
              <td className="py-1.5">{i + 1}</td>
              <td className="py-1.5">{[it.productName, it.model].filter(Boolean).join(' ')}</td>
              <td className="py-1.5">{it.color || '—'}</td>
              <td className="py-1.5 text-right tabular-nums">{it.quantity}</td>
              <td className="py-1.5 text-right tabular-nums">{BDT(it.sellingPrice || 0)}</td>
              <td className="py-1.5 text-right tabular-nums">{BDT(it.totalSelling || 0)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="ml-auto mt-3 w-64 space-y-1 text-sm">
        <div className="flex justify-between font-bold"><span>মোট</span><span className="tabular-nums">{BDT(total)}</span></div>
        {advance > 0 && <div className="flex justify-between"><span>অগ্রিম পরিশোধ</span><span className="tabular-nums">{BDT(advance)}</span></div>}
        {advance > 0 && <div className="flex justify-between font-bold"><span>বাকি</span><span className="tabular-nums">{BDT(due)}</span></div>}
      </div>

      <div className="mt-8 text-center text-xs text-slate-600">আমাদের সাথে কেনাকাটার জন্য ধন্যবাদ।</div>
    </div>
  );
}
