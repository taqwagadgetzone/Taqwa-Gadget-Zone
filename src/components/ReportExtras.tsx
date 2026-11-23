import { useMemo } from 'react';
import { downloadCSV } from '../services/accounting';
import { useActivity } from '../hooks/useActivity';
import type { ActivityKind } from '../services/activity';
import type { Expense, Product, Sale } from '../types';
import { BDT, Button, Card, Empty, cn } from './ui';

const digits = (p: string) => p.replace(/\D/g, '');

// সেরা কাস্টমার — ফোন নম্বর ধরে (ফোন না থাকলে নাম), সব সময়ের হিসাব
export function CustomerInsights({ sales }: { sales: Sale[] }) {
  const rows = useMemo(() => {
    const map = new Map<string, { name: string; phone: string; orders: number; spent: number; last: string }>();
    for (const s of sales) {
      const phone = digits(s.customerPhone || '');
      const key = phone || (s.customerRef || '').trim();
      if (!key) continue;
      const cur = map.get(key) || { name: (s.customerRef || '').trim() || phone, phone, orders: 0, spent: 0, last: '' };
      cur.orders += 1;
      cur.spent += s.salesAmount || 0;
      if (!cur.last || s.date > cur.last) cur.last = s.date;
      map.set(key, cur);
    }
    return [...map.values()].sort((a, b) => b.spent - a.spent).slice(0, 10);
  }, [sales]);

  return (
    <Card className="overflow-hidden">
      <div className="border-b border-slate-100 px-4 py-3">
        <h2 className="text-sm font-bold text-slate-800">সেরা কাস্টমার (সব সময়ের)</h2>
        <p className="text-[11px] text-slate-500">ফোন নম্বর ধরে হিসাব। দুইবার বা তার বেশি অর্ডার করলে "নিয়মিত"।</p>
      </div>
      {rows.length === 0 ? (
        <Empty icon="👥" text="এখনো কাস্টমার নেই। ফোন নম্বরসহ সেল যোগ করলে এখানে আসবে।" />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-[#0E3B2C] text-left text-xs font-semibold text-[#FDEBD9]">
              <tr>
                <th className="px-4 py-2.5">কাস্টমার</th>
                <th className="px-4 py-2.5">ফোন</th>
                <th className="px-4 py-2.5 text-right">অর্ডার</th>
                <th className="px-4 py-2.5 text-right">মোট কেনা</th>
                <th className="px-4 py-2.5 text-right">শেষ অর্ডার</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map(r => (
                <tr key={`${r.phone}-${r.name}`} className="hover:bg-[#FFF4EA]">
                  <td className="px-4 py-2.5 font-semibold text-slate-900">
                    {r.name || '—'}
                    {r.orders >= 2 && (
                      <span className="ml-2 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-800">নিয়মিত</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 tabular-nums text-slate-600">{r.phone || '—'}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{r.orders}</td>
                  <td className="px-4 py-2.5 text-right font-semibold tabular-nums text-[#14513B]">{BDT(r.spent)}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-slate-500">{r.last}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

const KIND_LABEL: Record<ActivityKind, string> = { sale: 'সেল', product: 'প্রোডাক্ট', expense: 'খরচ' };
const KIND_TONE: Record<ActivityKind, string> = {
  sale: 'bg-[#E3F2EA] text-[#14513B]',
  product: 'bg-[#FDE6CF] text-[#B94A12]',
  expense: 'bg-[#E9F4DC] text-[#4D7C0F]',
};

// কে কখন কী বদলাল — সর্বশেষ ৫০টি
export function ActivityCard() {
  const items = useActivity();
  return (
    <Card className="overflow-hidden">
      <div className="border-b border-slate-100 px-4 py-3">
        <h2 className="text-sm font-bold text-slate-800">সাম্প্রতিক কার্যক্রম</h2>
        <p className="text-[11px] text-slate-500">কে কখন সেল, প্রোডাক্ট বা খরচ বদলেছেন।</p>
      </div>
      {items.length === 0 ? (
        <Empty icon="🕘" text="এখনো কোনো কার্যক্রম নেই। নতুন কোনো বদল হলে এখানে দেখাবে।" />
      ) : (
        <ul className="max-h-96 divide-y divide-slate-100 overflow-y-auto">
          {items.map(a => (
            <li key={a.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2.5 text-sm">
              <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-semibold', KIND_TONE[a.kind])}>{KIND_LABEL[a.kind]}</span>
              <span className="font-semibold text-slate-900">{a.action}</span>
              <span className="min-w-0 flex-1 truncate text-slate-600">{a.detail}</span>
              <span className="text-[11px] text-slate-400">{a.by}</span>
              <span className="text-[11px] tabular-nums text-slate-400">
                {new Date(a.timestamp).toLocaleString('bn-BD', { dateStyle: 'short', timeStyle: 'short' })}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

// ডেটা ব্যাকআপ — তিনটি CSV (Excel-এ খুলবে)
export function BackupCard({ sales, expenses, products }: { sales: Sale[]; expenses: Expense[]; products: Product[] }) {
  const stamp = new Date().toISOString().slice(0, 10);
  const exportSales = () => downloadCSV(`সেলস-ব্যাকআপ-${stamp}.csv`, [
    ['তারিখ', 'ইনভয়েস', 'কাস্টমার', 'ফোন', 'চ্যানেল', 'ধরন', 'মোট বিক্রি', 'নিট লাভ', 'স্ট্যাটাস', 'কুরিয়ার ইনভয়েস'],
    ...sales.map(s => [
      s.date, s.invoice || '', s.customerRef || '', s.customerPhone || '', s.customerChannel || '',
      s.saleType, s.salesAmount || 0, s.netProfit || 0, s.courierDeliveryStatus || '', s.courierInvoice || '',
    ]),
  ]);
  const exportExpenses = () => downloadCSV(`খরচ-ব্যাকআপ-${stamp}.csv`, [
    ['তারিখ', 'ক্যাটাগরি', 'বিবরণ', 'পরিমাণ'],
    ...expenses.map(e => [e.date, e.category, e.description, e.amount]),
  ]);
  const exportProducts = () => downloadCSV(`প্রোডাক্ট-ব্যাকআপ-${stamp}.csv`, [
    ['নাম', 'মডেল', 'ক্যাটাগরি', 'বর্তমান স্টক', 'মোট বিক্রি', 'ক্রয়মূল্য', 'বিক্রয়মূল্য'],
    ...products.map(p => [p.name, p.model, p.category, p.currentStock, p.totalSold, p.defaultPurchasePrice, p.defaultSellingPrice]),
  ]);
  return (
    <Card className="p-4">
      <h2 className="text-sm font-bold text-slate-800">ডেটা ব্যাকআপ</h2>
      <p className="mb-3 text-[11px] text-slate-500">মাসের শেষে বা দরকারে তিনটি ফাইল নামিয়ে রাখুন।</p>
      <div className="grid gap-2 sm:grid-cols-3">
        <Button variant="soft" onClick={exportSales}>📄 সেলস CSV</Button>
        <Button variant="soft" onClick={exportExpenses}>💸 খরচ CSV</Button>
        <Button variant="soft" onClick={exportProducts}>📦 প্রোডাক্ট CSV</Button>
      </div>
    </Card>
  );
}
