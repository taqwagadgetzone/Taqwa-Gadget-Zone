import { useMemo, useState } from 'react';
import { exportExpensesCSV, exportProductsCSV, exportSalesCSV, downloadAllBackups, lastBackupAt } from '../services/backup';
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
        <p className="text-xs text-slate-500">ফোন নম্বর ধরে হিসাব। দুইবার বা তার বেশি অর্ডার করলে "নিয়মিত"।</p>
      </div>
      {rows.length === 0 ? (
        <Empty icon="👥" text="এখনো কাস্টমার নেই। ফোন নম্বরসহ সেল যোগ করলে এখানে আসবে।" />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-[#0E3B2C] text-left text-xs font-semibold text-[#E6F3EC]">
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
                <tr key={`${r.phone}-${r.name}`} className="hover:bg-[#EEF8F3]">
                  <td className="px-4 py-2.5 font-semibold text-slate-900">
                    {r.name || '—'}
                    {r.orders >= 2 && (
                      <span className="ml-2 rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-800">নিয়মিত</span>
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
  product: 'bg-[#D5EEE1] text-[#14513B]',
  expense: 'bg-[#E9F4DC] text-[#4D7C0F]',
};

// কে কখন কী বদলাল — সর্বশেষ ৫০টি
export function ActivityCard() {
  const items = useActivity();
  return (
    <Card className="overflow-hidden">
      <div className="border-b border-slate-100 px-4 py-3">
        <h2 className="text-sm font-bold text-slate-800">সাম্প্রতিক কার্যক্রম</h2>
        <p className="text-xs text-slate-500">কে কখন সেল, প্রোডাক্ট বা খরচ বদলেছেন।</p>
      </div>
      {items.length === 0 ? (
        <Empty icon="🕘" text="এখনো কোনো কার্যক্রম নেই। নতুন কোনো বদল হলে এখানে দেখাবে।" />
      ) : (
        <ul className="max-h-96 divide-y divide-slate-100 overflow-y-auto">
          {items.map(a => (
            <li key={a.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2.5 text-sm">
              <span className={cn('rounded-full px-2 py-0.5 text-[11px] font-semibold', KIND_TONE[a.kind])}>{KIND_LABEL[a.kind]}</span>
              <span className="font-semibold text-slate-900">{a.action}</span>
              <span className="min-w-0 flex-1 truncate text-slate-600">{a.detail}</span>
              <span className="text-xs text-slate-400">{a.by}</span>
              <span className="text-xs tabular-nums text-slate-400">
                {new Date(a.timestamp).toLocaleString('bn-BD', { dateStyle: 'short', timeStyle: 'short' })}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

// ডেটা ব্যাকআপ — তিনটি CSV (Excel-এ খুলবে); "সব একসাথে" নিলে শেষ ব্যাকআপের তারিখ থাকে
export function BackupCard({ sales, expenses, products }: { sales: Sale[]; expenses: Expense[]; products: Product[] }) {
  const [last, setLast] = useState(lastBackupAt());
  const all = () => {
    downloadAllBackups(sales, expenses, products);
    setLast(lastBackupAt());
  };
  return (
    <Card className="p-4">
      <h2 className="text-sm font-bold text-slate-800">ডেটা ব্যাকআপ</h2>
      <p className="mb-3 text-xs text-slate-500">
        শেষ ব্যাকআপ: {last ? new Date(last).toLocaleDateString('bn-BD', { dateStyle: 'medium' }) : 'এখনো নেওয়া হয়নি'}। প্রতি ৩০ দিনে একবার নিন।
      </p>
      <div className="grid gap-2 sm:grid-cols-4">
        <Button variant="primary" onClick={all}>⬇️ সব একসাথে</Button>
        <Button variant="soft" onClick={() => exportSalesCSV(sales)}>📄 সেলস CSV</Button>
        <Button variant="soft" onClick={() => exportExpensesCSV(expenses)}>💸 খরচ CSV</Button>
        <Button variant="soft" onClick={() => exportProductsCSV(products)}>📦 প্রোডাক্ট CSV</Button>
      </div>
    </Card>
  );
}

// একই ফোনে ভিন্ন নাম, বা একই নামে ভিন্ন ফোন — সম্ভাব্য ডুপ্লিকেট কাস্টমার
export function DuplicateCard({ sales }: { sales: Sale[] }) {
  const { byPhone, byName } = useMemo(() => {
    const phoneNames = new Map<string, Map<string, number>>();
    const namePhones = new Map<string, Map<string, number>>();
    for (const s of sales) {
      const phone = digits(s.customerPhone || '');
      const name = (s.customerRef || '').trim();
      if (phone && name) {
        const names = phoneNames.get(phone) ?? new Map<string, number>();
        names.set(name, (names.get(name) || 0) + 1);
        phoneNames.set(phone, names);
        const key = name.toLowerCase();
        const phones = namePhones.get(key) ?? new Map<string, number>();
        phones.set(phone, (phones.get(phone) || 0) + 1);
        namePhones.set(key, phones);
      }
    }
    const pick = (m: Map<string, Map<string, number>>) => [...m.entries()]
      .filter(([, v]) => v.size > 1)
      .map(([k, v]) => ({ key: k, values: [...v.entries()].sort((a, b) => b[1] - a[1]).map(([x, n]) => `${x} (${n})`) }))
      .sort((a, b) => b.values.length - a.values.length)
      .slice(0, 12);
    return { byPhone: pick(phoneNames), byName: pick(namePhones) };
  }, [sales]);

  const none = byPhone.length === 0 && byName.length === 0;
  return (
    <Card className="overflow-hidden">
      <div className="border-b border-slate-100 px-4 py-3">
        <h2 className="text-sm font-bold text-slate-800">সম্ভাব্য ডুপ্লিকেট কাস্টমার</h2>
        <p className="text-xs text-slate-500">একই ফোনে ভিন্ন নাম, বা একই নামে ভিন্ন ফোন। এডিট করে ঠিক করে নিন।</p>
      </div>
      {none ? (
        <Empty icon="✅" text="কোনো সন্দেহজনক ডুপ্লিকেট পাওয়া যায়নি" />
      ) : (
        <div className="grid gap-4 p-4 md:grid-cols-2">
          <div>
            <div className="mb-2 text-xs font-semibold text-slate-600">একই ফোন, ভিন্ন নাম</div>
            {byPhone.length === 0 ? <div className="text-xs text-slate-400">নেই</div> : (
              <ul className="space-y-2">
                {byPhone.map(r => (
                  <li key={r.key} className="rounded-xl bg-[#EEF8F3] px-3 py-2 text-xs">
                    <div className="font-mono font-semibold text-[#0E3B2C]">📞 {r.key}</div>
                    <div className="text-slate-600">{r.values.join(' · ')}</div>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div>
            <div className="mb-2 text-xs font-semibold text-slate-600">একই নাম, ভিন্ন ফোন</div>
            {byName.length === 0 ? <div className="text-xs text-slate-400">নেই</div> : (
              <ul className="space-y-2">
                {byName.map(r => (
                  <li key={r.key} className="rounded-xl bg-[#EEF8F3] px-3 py-2 text-xs">
                    <div className="font-semibold text-[#0E3B2C]">👤 {r.key}</div>
                    <div className="font-mono text-slate-600">{r.values.join(' · ')}</div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </Card>
  );
}
