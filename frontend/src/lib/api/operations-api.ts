import { apiClient } from './client';

export interface CounterService { serviceId: number; clusterId: number; name: string; unit: string; price: string; }
export interface CounterInvoice { invoiceId: number; invoiceCode: string; bookingId: number; courtAmount: string; total: string; paymentMethod: string; items: { serviceName: string; quantity: number; unitPrice: string; subtotal: string }[]; }
export interface CounterBooking { bookingId: number; bookingCode: string; clusterId: number; startTime: string; endTime: string; status: string; totalAmount?: number | null; }
export interface CounterCluster { clusterId: number; name: string; address: string; city: string; }
export interface CounterCustomer { userId: number; fullName: string; phoneNumber: string; }
export interface CounterCheckInResult { bookingId: number; bookingCode: string; status: string; totalAmount: number | null; priceWarning?: string; }

export async function listCounterServices(clusterId?: number) {
  const { data } = await apiClient.get<CounterService[]>('/operations/services', { params: clusterId ? { clusterId } : {} });
  return data;
}
export async function listCounterBookings() {
  const { data } = await apiClient.get<{ items: CounterBooking[]; total: number }>('/operations/bookings');
  return data;
}
export async function listCounterClusters() {
  const { data } = await apiClient.get<CounterCluster[]>('/operations/clusters');
  return data;
}
export async function findCounterCustomer(phone: string) {
  const { data } = await apiClient.get<CounterCustomer>('/operations/customers', { params: { phone } });
  return data;
}
export async function addCounterService(input: { clusterId: number; name: string; unit: string; price: number }) {
  const { data } = await apiClient.post<CounterService>('/operations/services', input);
  return data;
}
export async function deactivateCounterService(serviceId: number) {
  await apiClient.delete(`/operations/services/${serviceId}`);
}
export async function updateCounterService(serviceId: number, input: { name?: string; unit?: string; price?: number }) {
  const { data } = await apiClient.patch<CounterService>(`/operations/services/${serviceId}`, input);
  return data;
}
export async function checkInBooking(code: string) {
  const { data } = await apiClient.post<CounterCheckInResult>('/operations/check-in', { code });
  return data;
}
export async function createWalkIn(input: { slotIds: number[]; customerUserId: number; expectedTotalAmount?: number }) {
  const { data } = await apiClient.post('/operations/walk-in', input);
  return data;
}
export async function createCounterInvoice(input: { bookingId: number; paymentMethod: 'CASH'|'CARD'|'TRANSFER'; items: { serviceId: number; quantity: number }[] }) {
  const { data } = await apiClient.post<CounterInvoice>('/operations/invoices', input);
  return data;
}
