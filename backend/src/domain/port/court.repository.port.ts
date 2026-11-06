import { Court, CourtCluster } from '../model/court.entity';

export const COURT_REPOSITORY = 'COURT_REPOSITORY';

export interface CourtSearchCriteria {
  city?: string;
  clusterId?: number;
  courtType?: string;
  /** Chi lay cum da duoc Admin duyet (FR-15) va san con hoat dong. */
  bookableOnly?: boolean;
  ownerId?: number;

}
export interface CreateClusterData {
  name: string;
  address: string;
  city: string;
  description?: string | null;
  ownerId: number;
}

export interface UpdateClusterData {
  name?: string;
  address?: string;
  city?: string;
  description?: string | null;
}

export interface CreateCourtData {
  clusterId: number;
  name: string;
  courtType?: string;
  surface?: string | null;
  openingTime?: string;
  closingTime?: string;
  slotDurationMinutes?: number;
}

export interface UpdateCourtData {
  name?: string;
  courtType?: string;
  surface?: string | null;
  openingTime?: string;
  closingTime?: string;
  slotDurationMinutes?: number;
}

/** Booking Context chi can doc reference data cua Thanh vien 2. */
export interface ICourtRepository {
  findCourts(criteria: CourtSearchCriteria): Promise<Court[]>;
  findCourtById(courtId: number): Promise<Court | null>;
  findClusterById(clusterId: number): Promise<CourtCluster | null>;
  findClusters(criteria: CourtSearchCriteria): Promise<CourtCluster[]>;
  findCourtsByIds(courtIds: number[]): Promise<Court[]>;
  createCluster(data: CreateClusterData): Promise<CourtCluster>;
  updateCluster(clusterId: number, data: UpdateClusterData): Promise<CourtCluster | null>;
  setClusterActive(clusterId: number, isActive: boolean): Promise<void>;
  setClusterStatus(clusterId: number, status: 'APPROVED' | 'REJECTED'): Promise<CourtCluster | null>;
  createCourt(data: CreateCourtData): Promise<Court>;
  updateCourt(courtId: number, data: UpdateCourtData): Promise<Court | null>;
  setCourtActive(courtId: number, isActive: boolean): Promise<void>;
}
