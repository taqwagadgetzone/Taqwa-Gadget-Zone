// ব্যাকআপ — তিনটি CSV (Excel-এ খোলে) ও শেষ ব্যাকআপের সময়। মাসে একবার মনে করিয়ে দেয়।
import type { Expense, Product, Sale } from '../types';
import { downloadCSV } from './accounting';

const KEY = 'tgz_last_backup_at';
export const BACKUP_EVERY_DAYS = 30;

export const lastBackupAt = (): number => Number(localStorage.getItem(KEY) || 0);

/** শেষ ব্যাকআপের ৩০ দিন পার হলে বা কখনো না নেওয়া হলে true */
export const backupDue = (): boolean => Date.now() - lastBackupAt() > BACKUP_EVERY_DAYS * 86400000;

const stampNow = () => new Date().toISOString().slice(0, 10);

export function exportSalesCSV(sales: Sale[]) {
  downloadCSV(`সেলস-ব্যাকআপ-${stampNow()}.csv`, [
    ['তারিখ', 'ইনভয়েস', 'কাস্টমার', 'ফোন', 'চ্যানেল', 'ধরন', 'মোট বিক্রি', 'নিট লাভ', 'স্ট্যাটাস', 'কুরিয়ার ইনভয়েস'],
    ...sales.map(s => [
      s.date, s.invoice || '', s.customerRef || '', s.customerPhone || '', s.customerChannel || '',
      s.saleType, s.salesAmount || 0, s.netProfit || 0, s.courierDeliveryStatus || '', s.courierInvoice || '',
    ]),
  ]);
}

export function exportExpensesCSV(expenses: Expense[]) {
  downloadCSV(`খরচ-ব্যাকআপ-${stampNow()}.csv`, [
    ['তারিখ', 'ক্যাটাগরি', 'বিবরণ', 'পরিমাণ'],
    ...expenses.map(e => [e.date, e.category, e.description, e.amount]),
  ]);
}

export function exportProductsCSV(products: Product[]) {
  downloadCSV(`প্রোডাক্ট-ব্যাকআপ-${stampNow()}.csv`, [
    ['নাম', 'মডেল', 'ক্যাটাগরি', 'বর্তমান স্টক', 'মোট বিক্রি', 'ক্রয়মূল্য', 'বিক্রয়মূল্য'],
    ...products.map(p => [p.name, p.model, p.category, p.currentStock, p.totalSold, p.defaultPurchasePrice, p.defaultSellingPrice]),
  ]);
}

/** তিনটি ফাইল একসাথে; শেষ ব্যাকআপের সময় সেভ হয় */
export function downloadAllBackups(sales: Sale[], expenses: Expense[], products: Product[]) {
  exportSalesCSV(sales);
  exportExpensesCSV(expenses);
  exportProductsCSV(products);
  localStorage.setItem(KEY, String(Date.now()));
}
