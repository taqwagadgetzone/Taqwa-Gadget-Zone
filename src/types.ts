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
