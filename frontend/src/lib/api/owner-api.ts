import { apiClient } from './client';

export interface OwnerCourt {
  courtId: number;
  clusterId: number;
  name: string;
  courtType: string;
  isActive: boolean | number;
  openingTime: string;
  closingTime: string;
}

export interface OwnerCluster {
  clusterId: number;
  name: string;
  address: string;
  city: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  isActive: boolean | number;
  courts: OwnerCourt[];
}

export type DayType = 'WEEKDAY' | 'WEEKEND' | 'HOLIDAY';

export const DAY_TYPE_LABELS: Record<DayType, string> = {
  WEEKDAY: 'Ngày thường',
  WEEKEND: 'Cuối tuần',
  HOLIDAY: 'Ngày lễ',
};

export interface PricingRule {
  ruleId: number;
  clusterId: number;
  courtType: string | null;
  dayType: DayType;
  startTime: string;
  endTime: string;
  pricePerHour: number;
}

export async function listMyClusters(): Promise<OwnerCluster[]> {
  const { data } = await apiClient.get<OwnerCluster[]>('/owner/clusters');
  return data;
}

export async function createCluster(payload: { name: string; address: string; city: string }) {
  await apiClient.post('/owner/clusters', payload);
}

export async function createCourt(clusterId: number, payload: { name: string; courtType: string }) {
  await apiClient.post(`/owner/clusters/${clusterId}/courts`, payload);
}

export async function hideCourt(courtId: number) {
  await apiClient.delete(`/owner/courts/${courtId}`);
}

export async function listPricingRules(clusterId: number): Promise<PricingRule[]> {
  const { data } = await apiClient.get<PricingRule[]>(`/owner/clusters/${clusterId}/pricing-rules`);
  return data;
}

export async function createPricingRule(
  clusterId: number,
  payload: { courtType?: string; dayType: DayType; startTime: string; endTime: string; pricePerHour: number },
) {
  await apiClient.post(`/owner/clusters/${clusterId}/pricing-rules`, payload);
}

export async function deletePricingRule(ruleId: number) {
  await apiClient.delete(`/owner/pricing-rules/${ruleId}`);
}