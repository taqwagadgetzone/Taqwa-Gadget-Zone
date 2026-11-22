// Steadfast Courier API Service
// Calls go through /steadfast.php on our server, so the API keys never reach the browser.
import { auth } from '../firebase';

const PROXY = '/steadfast.php';

async function proxyFetch(query: string, init: RequestInit = {}): Promise<Response> {
  const user = auth.currentUser;
  if (!user) throw new Error('লগইন প্রয়োজন');
  const token = await user.getIdToken();
  return fetch(`${PROXY}?${query}`, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  });
}

export interface SteadfastCreateOrderPayload {
  invoice: string;
  recipient_name: string;
  recipient_phone: string;
  recipient_address: string;
  cod_amount: number;
  note?: string;
}

export interface SteadfastOrderResponse {
  status: number;
  consignment?: {
    consignment_id: number;
    tracking_code: string;
    invoice: string;
    recipient_name: string;
    recipient_phone: string;
    recipient_address: string;
    cod_amount: number;
    status: string;
    created_at: string;
  };
  errors?: Record<string, string[]>;
  message?: string;
}

export interface SteadfastStatusResponse {
  status: number;
  delivery_status?: string;
  consignment?: {
    consignment_id: number;
    tracking_code: string;
    status: string;
  };
}

// Steadfast delivery status Bengali labels
export const DELIVERY_STATUS_LABELS: Record<string, string> = {
  'in_review': 'রিভিউ চলছে',
  'pending': 'অপেক্ষামান',
  'processing': 'প্রসেসিং',
  'picked_up': 'পিক আপ হয়েছে',
  'in_transit': 'ট্রানজিটে',
  'delivered': 'ডেলিভারি হয়েছে',
  'partial_delivered': 'আংশিক ডেলিভারি',
  'cancelled': 'বাতিল',
  'hold': 'হোল্ড',
  'returned_to_courier': 'কুরিয়ারে ফেরত',
  'returned_to_merchant': 'মার্চেন্টে ফেরত',
  'partial_returned_to_merchant': 'আংশিক ফেরত',
  'unknown': 'অজানা',
};

export function getStatusLabel(status: string): string {
  return DELIVERY_STATUS_LABELS[status] ?? status;
}

export function getStatusColor(status: string): string {
  switch (status) {
    case 'delivered':
      return '#16a34a'; // green
    case 'cancelled':
    case 'returned_to_merchant':
    case 'partial_returned_to_merchant':
    case 'returned_to_courier':
      return '#dc2626'; // red
    case 'in_transit':
    case 'picked_up':
    case 'processing':
      return '#d97706'; // amber
    case 'hold':
      return '#7c3aed'; // purple
    default:
      return '#6b7280'; // gray
  }
}

/**
 * Create a new parcel booking with Steadfast
 */
export async function createParcel(
  payload: SteadfastCreateOrderPayload
): Promise<SteadfastOrderResponse> {
  const response = await proxyFetch('action=create', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Steadfast API Error ${response.status}: ${text}`);
  }
  return response.json();
}

/**
 * Get delivery status by consignment ID
 */
export async function getStatusByCid(
  consignmentId: number | string
): Promise<SteadfastStatusResponse> {
  const response = await proxyFetch(`action=status&cid=${encodeURIComponent(String(consignmentId))}`);
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Steadfast Status Error ${response.status}: ${text}`);
  }
  return response.json();
}

/**
 * Get current account balance
 */
export async function getBalance(): Promise<{ status: number; current_balance: number }> {
  const response = await proxyFetch('action=balance');
  if (!response.ok) {
    throw new Error(`Balance Error ${response.status}`);
  }
  return response.json();
}
