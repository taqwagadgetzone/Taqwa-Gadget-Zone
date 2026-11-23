import { useState } from 'react';
import { Link } from 'react-router-dom';
import { backupDue, BACKUP_EVERY_DAYS, downloadAllBackups, lastBackupAt } from '../services/backup';
import { ATTENTION_STATUSES } from '../services/courierSync';
import { summarize, inRange } from '../services/accounting';
import { saveGoals, useGoals } from '../hooks/useGoals';
import type { Expense, Product, Sale } from '../types';
import { BDT, Badge, Button, Card, cn, inputCls, labelCls } from './ui';

const STATUS_LABEL: Record<string, string> = {
  hold: 'হোল্ড',
  cancelled: 'বাতিল',
  returned_to_courier: 'কুরিয়ারে ফেরত',
  returned_to_merchant: 'ফেরত এসেছে',
  partial_returned_to_merchant: 'আংশিক ফেরত',
};

// ব্যাকআপ মনে করানো — ৩০ দিন পার হলে সতর্কবার্তা; এক ক্লিকে তিনটি ফাইল
export function BackupReminder({ sales, expenses, products }: { sales: Sale[]; expenses: Expense[]; products: Product[] }) {
  const [due, setDue] = useState(backupDue());
  if (!due) return null;
  const last = lastBackupAt();
  return (
    <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3">
      <div className="text-sm text-amber-900">
        <b>💾 ব্যাকআপ নেওয়ার সময় হয়েছে।</b>{' '}
        <span className="text-amber-800">
          {last ? `শেষ ব্যাকআপ ${new Date(last).toLocaleDateString('bn-BD', { dateStyle: 'medium' })}` : 'এখনো কোনো ব্যাকআপ নেওয়া হয়নি'} (প্রতি {BACKUP_EVERY_DAYS} দিনে একবার)।
        </span>
      </div>
      <Button variant="accent" onClick={() => { downloadAllBackups(sales, expenses, products); setDue(false); }}>
        ⬇️ এখনই ব্যাকআপ নিন
      </Button>
    </div>
  );
}

// কুরিয়ার সতর্কতা — ফেরত, বাতিল বা হোল্ড সেল; নোটিফিকেশন চালুর বাটনও এখানে
export function CourierAlerts({ sales }: { sales: Sale[] }) {
  const items = sales
    .filter(s => s.saleType === 'Courier Sale' && ATTENTION_STATUSES.includes(s.courierDeliveryStatus || ''))
    .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
  const canNotify = 'Notification' in window;
  const [perm, setPerm] = useState<NotificationPermission | 'unsupported'>(
    canNotify ? Notification.permission : 'unsupported'
  );
  const enable = async () => {
    if (!canNotify) return;
    setPerm(await Notification.requestPermission());
  };
  if (items.length === 0 && perm !== 'default') return null;
  return (
    <Card className="mb-5 overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-4 py-3">
        <h2 className="text-sm font-bold text-rose-700">⚠️ কুরিয়ার সতর্কতা {items.length > 0 && `— ${items.length}টি সেল`}</h2>
        {perm === 'default' && (
          <button type="button" onClick={enable}
            className="rounded-lg bg-[#14513B] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#0E3B2C]">
            🔔 নোটিফিকেশন চালু করুন
          </button>
        )}
        {perm === 'granted' && <span className="text-xs text-emerald-700">🔔 নোটিফিকেশন চালু আছে</span>}
      </div>
      {items.length > 0 && (
        <ul className="divide-y divide-slate-100">
          {items.slice(0, 8).map(s => (
            <li key={s.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 text-sm">
              <div className="min-w-0">
                <span className="font-mono text-xs font-semibold text-emerald-900">{s.invoice || s.id.slice(0, 8).toUpperCase()}</span>
                <span className="ml-2 font-medium text-slate-800">{s.customerRef || 'সরাসরি বিক্রয়'}</span>
                <span className="ml-2 text-xs text-slate-400">{s.date}</span>
              </div>
              <div className="flex items-center gap-2">
                <Badge tone="red">{STATUS_LABEL[s.courierDeliveryStatus || ''] || s.courierDeliveryStatus}</Badge>
                <Link to={`/sales?q=${encodeURIComponent(s.invoice || s.customerPhone || '')}`}
                  className="text-xs font-semibold text-emerald-700 hover:underline">দেখুন →</Link>
              </div>
            </li>
          ))}
        </ul>
      )}
      {items.length > 8 && <div className="px-4 py-2 text-xs text-slate-400">আরও {items.length - 8}টি সেল সেলস পেজে আছে</div>}
    </Card>
  );
}

// মাসিক লক্ষ্য — বিক্রি ও নেট লাভ কতটা এগোলো
export function GoalCard({ sales, expenses, month }: { sales: Sale[]; expenses: Expense[]; month: string }) {
  const { goals, loaded } = useGoals();
  const [editing, setEditing] = useState(false);
  const [draftSales, setDraftSales] = useState('');
  const [draftProfit, setDraftProfit] = useState('');
  const [saving, setSaving] = useState(false);

  const r = { kind: 'month' as const, month };
  const v = summarize(sales.filter(s => inRange(s.date, r)), expenses.filter(e => inRange(e.date, r)));

  const startEdit = () => {
    setDraftSales(String(goals?.sales || ''));
    setDraftProfit(String(goals?.profit || ''));
    setEditing(true);
  };
  const save = async () => {
    setSaving(true);
    try {
      await saveGoals({ sales: Number(draftSales) || 0, profit: Number(draftProfit) || 0 });
      setEditing(false);
    } catch (err) {
      alert('লক্ষ্য সেভ হয়নি: ' + String(err));
    }
    setSaving(false);
  };

  const row = (label: string, value: number, target: number, tone: 'blue' | 'green') => {
    const pct = target > 0 ? Math.min(100, Math.round((value / target) * 100)) : 0;
    return (
      <div>
        <div className="mb-1 flex items-center justify-between text-xs">
          <span className="font-semibold text-slate-700">{label}</span>
          <span className="tabular-nums text-slate-600">
            {BDT(value)} / {target > 0 ? BDT(target) : '—'} {target > 0 && <b className={tone === 'green' ? 'text-emerald-700' : 'text-blue-700'}>({pct}%)</b>}
          </span>
        </div>
        <div className="h-2.5 overflow-hidden rounded-full bg-slate-100">
          <div className={cn('h-full rounded-full transition-all', tone === 'green' ? 'bg-emerald-500' : 'bg-blue-500')} style={{ width: `${pct}%` }} />
        </div>
      </div>
    );
  };

  if (!loaded) return null;
  return (
    <Card className="mb-5 p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="text-sm font-bold text-slate-800">এই মাসের লক্ষ্য</h2>
        {!editing && (
          <button type="button" onClick={startEdit} className="text-xs font-semibold text-emerald-700 hover:underline">
            {goals ? 'লক্ষ্য বদলান' : 'লক্ষ্য ঠিক করুন'}
          </button>
        )}
      </div>

      {editing ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className={labelCls}>বিক্রির লক্ষ্য (৳)</label>
            <input type="number" inputMode="decimal" value={draftSales} onChange={e => setDraftSales(e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>নেট লাভের লক্ষ্য (৳)</label>
            <input type="number" inputMode="decimal" value={draftProfit} onChange={e => setDraftProfit(e.target.value)} className={inputCls} />
          </div>
          <div className="flex gap-2 sm:col-span-2">
            <Button variant="primary" onClick={save} disabled={saving}>{saving ? 'সেভ হচ্ছে…' : 'সেভ করুন'}</Button>
            <Button variant="soft" onClick={() => setEditing(false)}>বাতিল</Button>
          </div>
        </div>
      ) : goals ? (
        <div className="space-y-3">
          {row('বিক্রি', v.sales, goals.sales, 'blue')}
          {row('নেট লাভ', v.netProfit, goals.profit, 'green')}
        </div>
      ) : (
        <div className="py-3 text-center text-sm text-slate-400">এখনো কোনো লক্ষ্য নেই। বিক্রি ও লাভের লক্ষ্য দিলে এখানে অগ্রগতি দেখাবে।</div>
      )}
    </Card>
  );
}
