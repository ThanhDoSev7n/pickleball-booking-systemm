export const MATCH_REPOSITORY = 'MATCH_REPOSITORY';

export type SkillLevel = 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED';

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

export interface CreateMatchData {
  creatorId: number;
  clusterId: number;
  playDate: string;
  startTime: string;
  endTime: string;
  skillLevel: SkillLevel;
  playersNeeded: number;
  description?: string | null;
}

export interface MatchFilter {
  skillLevel?: SkillLevel;
  clusterId?: number;
}

export interface IMatchRepository {
  createPost(data: CreateMatchData): Promise<MatchPost>;
  findPosts(filter: MatchFilter): Promise<MatchPost[]>;
  findPostById(postId: number): Promise<MatchPost | null>;
  /** Giu cho trong transaction, nem loi neu day / da tham gia / khong ton tai. */
  join(postId: number, userId: number): Promise<void>;
  leave(postId: number, userId: number): Promise<void>;
  cancelPost(postId: number): Promise<void>;
}