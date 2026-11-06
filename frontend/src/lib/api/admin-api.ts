import { apiClient } from './client';
import type { OwnerStats, StatsRange } from './owner-api';

export interface AdminUser {
  userId: number;
  fullName: string;
  email: string;
  phoneNumber: string;
  role: 'CUSTOMER' | 'STAFF' | 'OWNER' | 'ADMIN';
  isActive: boolean | number;
  createdAt: string;
}

export interface AdminCluster {
  clusterId: number;
  name: string;
  address: string;
  city: string;
  ownerId: number;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  isActive: boolean | number;
  courts: { courtId: number; name: string; courtType: string }[];
}

export async function fetchAdminStats(range: StatsRange) {
  const { data } = await apiClient.get<OwnerStats>('/admin/stats', { params: { range } });
  return data;
}
export async function fetchAdminUsers() {
  const { data } = await apiClient.get<AdminUser[]>('/admin/users');
  return data;
}
export async function setAdminUserActive(id: number, isActive: boolean) {
  const { data } = await apiClient.patch<AdminUser>(`/admin/users/${id}/active`, { isActive });
  return data;
}
export async function setAdminUserRole(id: number, role: AdminUser['role']) {
  const { data } = await apiClient.patch<AdminUser>(`/admin/users/${id}/role`, { role });
  return data;
}
export async function fetchAdminClusters() {
  const { data } = await apiClient.get<AdminCluster[]>('/admin/clusters');
  return data;
}
export async function decideAdminCluster(id: number, status: 'APPROVED' | 'REJECTED') {
  const { data } = await apiClient.patch<AdminCluster>(`/admin/clusters/${id}/decision`, { status });
  return data;
}