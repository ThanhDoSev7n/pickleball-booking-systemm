import { apiClient } from './client';

export type SkillLevel = 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED';

export const SKILL_LABELS: Record<SkillLevel, string> = {
  BEGINNER: 'Mới chơi',
  INTERMEDIATE: 'Trung bình',
  ADVANCED: 'Nâng cao',
};

export interface MatchPost {
  postId: number;
  creatorId: number;
  creatorName: string;
  clusterId: number;
  clusterName: string;
  playDate: string;
  startTime: string;
  endTime: string;
  skillLevel: SkillLevel;
  playersNeeded: number;
  joinedCount: number;
  description: string | null;
  status: 'OPEN' | 'FULL' | 'CANCELLED';
}

export interface CreateMatchPayload {
  clusterId: number;
  playDate: string;
  startTime: string;
  endTime: string;
  skillLevel: SkillLevel;
  playersNeeded: number;
  description?: string;
}

export async function listMatches(skillLevel?: SkillLevel): Promise<MatchPost[]> {
  const { data } = await apiClient.get<MatchPost[]>('/matches', {
    params: skillLevel ? { skillLevel } : {},
  });
  return data;
}

export async function createMatch(payload: CreateMatchPayload): Promise<MatchPost> {
  const { data } = await apiClient.post<MatchPost>('/matches', payload);
  return data;
}

export async function joinMatch(postId: number): Promise<MatchPost> {
  const { data } = await apiClient.post<MatchPost>(`/matches/${postId}/join`);
  return data;
}

export async function leaveMatch(postId: number): Promise<MatchPost> {
  const { data } = await apiClient.delete<MatchPost>(`/matches/${postId}/join`);
  return data;
}

export async function cancelMatch(postId: number): Promise<void> {
  await apiClient.delete(`/matches/${postId}`);
}