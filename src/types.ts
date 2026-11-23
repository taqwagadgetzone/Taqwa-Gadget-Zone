export interface ColorStock {
  [color: string]: number;
}

export interface Product {
  id: string;
  name: string;
  model: string;
  category: string;
  colors: string[];
  colorStock: ColorStock;
  colorSold: ColorStock;
  colorOpeningStock: ColorStock;
  currentStock: number;
  totalSold: number;
  openingStock: number;
  stockValue: number;
  status: 'IN STOCK' | 'LOW STOCK' | 'OUT OF STOCK';
  defaultPurchasePrice: number;
  defaultSellingPrice: number;
}

export interface SaleItem {
  id: string;
  productId?: string;
  productName: string;
  model: string;
  category: string;
  color: string;
  quantity: number;
  purchasePrice: number;
  sellingPrice: number;
  totalPurchase: number;
  totalSelling: number;
  colorBreakdown: ColorStock;
}

export interface Sale {
  id: string;
  date: string;
  timestamp: number;
  saleType: 'Courier Sale' | 'Direct Sale';
  items: SaleItem[];
  quantity: number;
  purchasePrice: number;
  sellingPrice: number;
  salesAmount: number;
  netProfit: number;
  otherCost: number;
  model: string;
  // Courier fields
  courierName?: string;
  courierCharge?: number;
  courierConditionCost?: number;
  courierArea?: string;
  courierTrackingCode?: string;
  courierTrackingId?: string;
  courierConsignmentId?: number;
  steadfastConsignmentId?: number | string;
  courierDeliveryStatus?: string;
  courierOrderSentAt?: string;
  orderStatus?: string;
  orderNumber?: string;
  codAmount?: number;
  advanceAmount?: number;
  // Customer fields
  customerPhone?: string;
  customerAddress?: string;
  customerRef?: string;
  customerChannel?: string;
  deliveryNote?: string;
  // Order fields (v2)
  invoice?: string;
  // Steadfast-এ যে ইনভয়েস যাবে — আমাদের TGZ ইনভয়েস থেকে আলাদা
  courierInvoice?: string;
  // Steadfast-এর কাস্টমার ট্র্যাকিং লিংক (https://steadfast.com.bd/tl/…)
  courierTrackingLink?: string;
  paymentMethod?: string;
  trxId?: string;
  customerDistrict?: string;
  // স্টক ট্র্যাকিং: true = এখন স্টক থেকে বেরিয়ে আছে, false = ফেরত এসেছে, undefined = আগের ডেটা (স্টক স্পর্শ করা হয় না)
  stockAdjusted?: boolean;
  // ফেরত পণ্যের অবস্থা: resellable = আবার বিক্রয়যোগ্য, damaged = নষ্ট
  returnCondition?: 'resellable' | 'damaged';
  // নষ্ট পণ্য স্টক থেকে একবার বাদ দেওয়া হয়েছে কি না (ডাবল-বাদ এড়াতে)
  returnWrittenOff?: boolean;
}

export interface Expense {
  id: string;
  date: string;
  timestamp: number;
  category: string;
  description: string;
  amount: number;
  targetModel?: string;
  dollarAmount?: number;
  dollarRate?: number;
}

// ক্রয় রেকর্ড — সাপ্লায়ার থেকে কী কেনা হলো
export interface Purchase {
  id: string;
  date: string;
  timestamp: number;
  supplier: string;
  productId?: string;
  productName: string;
  color: string;
  quantity: number;
  unitCost: number;
  total: number;
  note?: string;
  // true = স্টকে যোগ হয়েছে (মুছলে আবার বাদ যায়)
  stockIn: boolean;
}

// Steadfast থেকে COD-এর টাকা কবে কত পাওয়া গেল
export interface Payout {
  id: string;
  date: string;
  timestamp: number;
  amount: number;
  reference?: string;
  note?: string;
}

// মাসিক লক্ষ্য — সব মাসে একই
export interface Goals {
  sales: number;
  profit: number;
}
