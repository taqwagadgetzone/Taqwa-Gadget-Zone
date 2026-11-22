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
  paymentMethod?: string;
  trxId?: string;
  customerDistrict?: string;
  // স্টক ট্র্যাকিং: true = এখন স্টক থেকে বেরিয়ে আছে, false = ফেরত এসেছে, undefined = আগের ডেটা (স্টক স্পর্শ করা হয় না)
  stockAdjusted?: boolean;
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
