import { Injectable } from '@nestjs/common';
import { DataSource, In } from 'typeorm';
import { Court, CourtCluster } from '../../../../domain/model/court.entity';
import {
  CourtSearchCriteria,
  ICourtRepository,
  CreateClusterData,
  CreateCourtData,
  UpdateClusterData,
  UpdateCourtData,
} from '../../../../domain/port/court.repository.port';
import { CourtType } from '../../../../domain/value-object/court-type.vo';
import { CourtClusterSchema } from '../entities/court-cluster.schema';
import { CourtSchema } from '../entities/court.schema';
import { toDomainCluster, toDomainCourt } from '../entity-mapper';

@Injectable()
export class TypeOrmCourtRepository implements ICourtRepository {
  constructor(private readonly dataSource: DataSource) {}

  async findCourts(criteria: CourtSearchCriteria): Promise<Court[]> {
    const qb = this.dataSource
      .createQueryBuilder(CourtSchema, 'court')
      // AndSelect: toDomainCourt doc row.cluster de lay clusterName/city cho view FR-01.
      .innerJoinAndSelect('court.cluster', 'cluster')
      .orderBy('cluster.cluster_id', 'ASC')
      .addOrderBy('court.court_id', 'ASC');

    if (criteria.bookableOnly ?? true) {
      qb.andWhere('cluster.status = :status', { status: 'APPROVED' })
        .andWhere('cluster.is_active = 1')
        .andWhere('court.is_active = 1');
    }
    if (criteria.clusterId !== undefined) {
      qb.andWhere('court.cluster_id = :clusterId', { clusterId: criteria.clusterId });
    }
    if (criteria.city !== undefined) {
      qb.andWhere('cluster.city = :city', { city: criteria.city });
    }
    if (criteria.courtType !== undefined) {
      qb.andWhere('court.court_type = :courtType', { courtType: criteria.courtType });
    }
    const rows = await qb.getMany();
    return rows.map(toDomainCourt);
  }

  async findCourtById(courtId: number): Promise<Court | null> {
    const row = await this.dataSource.manager.findOne(CourtSchema, { where: { courtId } });
    return row ? toDomainCourt(row) : null;
  }

  async findCourtsByIds(courtIds: number[]): Promise<Court[]> {
    if (courtIds.length === 0) {
      return [];
    }
    const rows = await this.dataSource.manager.find(CourtSchema, {
      where: { courtId: In(courtIds) },
      order: { courtId: 'ASC' },
    });
    return rows.map(toDomainCourt);
  }

  async findClusterById(clusterId: number): Promise<CourtCluster | null> {
    const row = await this.dataSource.manager.findOne(CourtClusterSchema, {
      where: { clusterId },
    });
    if (row === null) {
      return null;
    }
    const courts = await this.dataSource.manager.find(CourtSchema, {
      where: { clusterId },
      order: { courtId: 'ASC' },
    });
    return toDomainCluster(row, courts.map(toDomainCourt));
  }

  async findClusters(criteria: CourtSearchCriteria): Promise<CourtCluster[]> {
    const qb = this.dataSource.createQueryBuilder(CourtClusterSchema, 'cluster');
    if (criteria.bookableOnly ?? true) {
      qb.where('cluster.status = :status', { status: 'APPROVED' }).andWhere('cluster.is_active = 1');
    }
    if (criteria.city !== undefined) {
      qb.andWhere('cluster.city = :city', { city: criteria.city });
    }
        if (criteria.ownerId !== undefined) {
      qb.andWhere('cluster.owner_id = :ownerId', { ownerId: criteria.ownerId });
    }
    const rows = await qb.orderBy('cluster.cluster_id', 'ASC').getMany();

    const clusters: CourtCluster[] = [];
    for (const row of rows) {
      const courts = await this.dataSource.manager.find(CourtSchema, {
        where: { clusterId: row.clusterId },
        order: { courtId: 'ASC' },
      });
      clusters.push(toDomainCluster(row, courts.map(toDomainCourt)));
    }
    return clusters;
  }
    async createCluster(data: CreateClusterData): Promise<CourtCluster> {
    const repo = this.dataSource.getRepository(CourtClusterSchema);
    const saved = await repo.save(
      repo.create({
        name: data.name,
        address: data.address,
        city: data.city,
        description: data.description ?? null,
        ownerId: data.ownerId,
      }),
    );
    return (await this.findClusterById(saved.clusterId)) as CourtCluster;
  }

  async updateCluster(clusterId: number, data: UpdateClusterData): Promise<CourtCluster | null> {
    await this.dataSource.getRepository(CourtClusterSchema).update(clusterId, data);
    return this.findClusterById(clusterId);
  }

  async setClusterActive(clusterId: number, isActive: boolean): Promise<void> {
    await this.dataSource.getRepository(CourtClusterSchema).update(clusterId, { isActive });
  }

  async createCourt(data: CreateCourtData): Promise<Court> {
    const repo = this.dataSource.getRepository(CourtSchema);
    const saved = await repo.save(
      repo.create({
        clusterId: data.clusterId,
        name: data.name,
        courtType: (data.courtType as CourtType) ?? CourtType.OUTDOOR,
        surface: data.surface ?? null,
        openingTime: data.openingTime ?? '06:00',
        closingTime: data.closingTime ?? '22:00',
        slotDurationMinutes: data.slotDurationMinutes ?? 60,
      }),
    );
    return (await this.findCourtById(saved.courtId)) as Court;
  }

  async updateCourt(courtId: number, data: UpdateCourtData): Promise<Court | null> {
    await this.dataSource.getRepository(CourtSchema).update(courtId, {
      ...data,
      courtType: data.courtType as CourtType | undefined,
    });
    return this.findCourtById(courtId);
  }

  async setCourtActive(courtId: number, isActive: boolean): Promise<void> {
    await this.dataSource.getRepository(CourtSchema).update(courtId, { isActive });
  }
}

export function mapCourtType(value: string | undefined): string | undefined {
  return value;
}
