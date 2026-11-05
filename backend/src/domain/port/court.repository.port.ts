import { Court, CourtCluster } from '../model/court.entity';

export const COURT_REPOSITORY = 'COURT_REPOSITORY';

export interface CourtSearchCriteria {
  city?: string;
  clusterId?: number;
  courtType?: string;
  /** Chi lay cum da duoc Admin duyet (FR-15) va san con hoat dong. */
  bookableOnly?: boolean;
}

/** Booking Context chi can doc reference data cua Thanh vien 2. */
export interface ICourtRepository {
  findCourts(criteria: CourtSearchCriteria): Promise<Court[]>;
  findCourtById(courtId: number): Promise<Court | null>;
  findClusterById(clusterId: number): Promise<CourtCluster | null>;
  findClusters(criteria: CourtSearchCriteria): Promise<CourtCluster[]>;
  findCourtsByIds(courtIds: number[]): Promise<Court[]>;
}
