import { Inject, Injectable } from '@nestjs/common';
import {
  DomainError,
  DomainErrorCode,
  ForbiddenError,
  NotFoundDomainError,
} from '../../../domain/error/domain.error';
import { toDateString } from '../../../domain/model/booking-slot.entity';
import { COURT_REPOSITORY, ICourtRepository } from '../../../domain/port/court.repository.port';
import {
  CreateMatchData,
  IMatchRepository,
  MATCH_REPOSITORY,
  MatchFilter,
  MatchPost,
} from '../../../domain/port/match.repository.port';

@Injectable()
export class MatchmakingUseCase {
  constructor(
    @Inject(MATCH_REPOSITORY) private readonly matches: IMatchRepository,
    @Inject(COURT_REPOSITORY) private readonly courts: ICourtRepository,
  ) {}

  list(filter: MatchFilter): Promise<MatchPost[]> {
    return this.matches.findPosts(filter);
  }

  async create(data: CreateMatchData): Promise<MatchPost> {
    if (data.endTime <= data.startTime) {
      throw new DomainError(DomainErrorCode.INVALID_INPUT, 'Gio ket thuc phai sau gio bat dau');
    }
    if (data.playDate < toDateString(new Date())) {
      throw new DomainError(DomainErrorCode.INVALID_INPUT, 'Ngay choi khong duoc o qua khu');
    }
    const cluster = await this.courts.findClusterById(data.clusterId);
    if (cluster === null) {
      throw new NotFoundDomainError(DomainErrorCode.CLUSTER_NOT_FOUND, 'Khong tim thay cum san');
    }
    return this.matches.createPost(data);
  }

  async join(postId: number, userId: number): Promise<MatchPost> {
    await this.matches.join(postId, userId);
    return (await this.matches.findPostById(postId)) as MatchPost;
  }

  async leave(postId: number, userId: number): Promise<MatchPost> {
    await this.matches.leave(postId, userId);
    return (await this.matches.findPostById(postId)) as MatchPost;
  }

  async cancel(postId: number, userId: number): Promise<void> {
    const post = await this.matches.findPostById(postId);
    if (post === null) {
      throw new NotFoundDomainError(DomainErrorCode.MATCH_NOT_FOUND, 'Khong tim thay bai dang');
    }
    if (post.creatorId !== userId) {
      throw new ForbiddenError('Chi nguoi tao moi duoc huy bai dang');
    }
    await this.matches.cancelPost(postId);
  }
}