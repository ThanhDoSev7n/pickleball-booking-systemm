import { Inject, Injectable } from '@nestjs/common';
import { Court, CourtCluster } from '../../../domain/model/court.entity';
import {
  COURT_REPOSITORY,
  CreateCourtData,
  ICourtRepository,
  UpdateClusterData,
  UpdateCourtData,
} from '../../../domain/port/court.repository.port';
import {
  DomainError,
  DomainErrorCode,
  ForbiddenError,
  NotFoundDomainError,
} from '../../../domain/error/domain.error';
import { UserRole } from '../../../domain/value-object/user-role.vo';

export interface Requester {
  userId: number;
  role: UserRole;
}

/** Chu san quan ly cum san va san con cua chinh minh (ADMIN duoc quan ly tat ca). */
@Injectable()
export class ManageCourtsUseCase {
  constructor(@Inject(COURT_REPOSITORY) private readonly courts: ICourtRepository) {}

  listMyClusters(requester: Requester): Promise<CourtCluster[]> {
    return this.courts.findClusters({
      bookableOnly: false,
      ownerId: requester.role === UserRole.ADMIN ? undefined : requester.userId,
    });
  }

  createCluster(
    requester: Requester,
    data: { name: string; address: string; city: string; description?: string },
  ): Promise<CourtCluster> {
    return this.courts.createCluster({ ...data, ownerId: requester.userId });
  }

  async updateCluster(
    requester: Requester,
    clusterId: number,
    data: UpdateClusterData,
  ): Promise<CourtCluster> {
    await this.getOwnedCluster(requester, clusterId);
    return (await this.courts.updateCluster(clusterId, data)) as CourtCluster;
  }

  async setClusterActive(requester: Requester, clusterId: number, isActive: boolean): Promise<void> {
    await this.getOwnedCluster(requester, clusterId);
    await this.courts.setClusterActive(clusterId, isActive);
  }

  async createCourt(
    requester: Requester,
    clusterId: number,
    data: Omit<CreateCourtData, 'clusterId'>,
  ): Promise<Court> {
    await this.getOwnedCluster(requester, clusterId);
    this.checkHours(data.openingTime ?? '06:00', data.closingTime ?? '22:00');
    return this.courts.createCourt({ ...data, clusterId });
  }

  async updateCourt(requester: Requester, courtId: number, data: UpdateCourtData): Promise<Court> {
    const court = await this.getOwnedCourt(requester, courtId);
    this.checkHours(data.openingTime ?? court.openingTime, data.closingTime ?? court.closingTime);
    return (await this.courts.updateCourt(courtId, data)) as Court;
  }

  async setCourtActive(requester: Requester, courtId: number, isActive: boolean): Promise<void> {
    await this.getOwnedCourt(requester, courtId);
    await this.courts.setCourtActive(courtId, isActive);
  }

  private async getOwnedCluster(requester: Requester, clusterId: number): Promise<CourtCluster> {
    const cluster = await this.courts.findClusterById(clusterId);
    if (cluster === null) {
      throw new NotFoundDomainError(DomainErrorCode.CLUSTER_NOT_FOUND, 'Khong tim thay cum san');
    }
    if (requester.role !== UserRole.ADMIN && cluster.ownerId !== requester.userId) {
      throw new ForbiddenError('Ban khong phai chu cua cum san nay');
    }
    return cluster;
  }

  private async getOwnedCourt(requester: Requester, courtId: number): Promise<Court> {
    const court = await this.courts.findCourtById(courtId);
    if (court === null) {
      throw new NotFoundDomainError(DomainErrorCode.COURT_NOT_FOUND, 'Khong tim thay san');
    }
    await this.getOwnedCluster(requester, court.clusterId);
    return court;
  }

  private checkHours(opening: string, closing: string): void {
    if (closing.slice(0, 5) <= opening.slice(0, 5)) {
      throw new DomainError(
        DomainErrorCode.INVALID_INPUT,
        'Gio dong cua phai sau gio mo cua',
      );
    }
  }
}