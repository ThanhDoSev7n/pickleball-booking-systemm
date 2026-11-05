import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import {
  ConflictError,
  DomainError,
  DomainErrorCode,
  NotFoundDomainError,
} from '../../../../domain/error/domain.error';
import {
  CreateMatchData,
  IMatchRepository,
  MatchFilter,
  MatchPost,
} from '../../../../domain/port/match.repository.port';

const SELECT_POST = `
  SELECT p.post_id AS postId, p.creator_id AS creatorId, u.full_name AS creatorName,
         p.cluster_id AS clusterId, c.name AS clusterName,
         DATE_FORMAT(p.play_date, '%Y-%m-%d') AS playDate,
         TIME_FORMAT(p.start_time, '%H:%i') AS startTime,
         TIME_FORMAT(p.end_time, '%H:%i') AS endTime,
         p.skill_level AS skillLevel, p.players_needed AS playersNeeded,
         p.description AS description, p.status AS status,
         (SELECT COUNT(*) FROM match_participants mp WHERE mp.post_id = p.post_id) AS joinedCount
  FROM match_posts p
  INNER JOIN users u ON u.user_id = p.creator_id
  INNER JOIN court_clusters c ON c.cluster_id = p.cluster_id`;

function toPost(row: Record<string, unknown>): MatchPost {
  return {
    ...(row as unknown as MatchPost),
    postId: Number(row.postId),
    creatorId: Number(row.creatorId),
    clusterId: Number(row.clusterId),
    playersNeeded: Number(row.playersNeeded),
    joinedCount: Number(row.joinedCount),
  };
}

interface LockedPost {
  creator_id: number;
  players_needed: number;
  status: string;
}

@Injectable()
export class TypeOrmMatchRepository implements IMatchRepository {
  constructor(private readonly dataSource: DataSource) {}

  async createPost(data: CreateMatchData): Promise<MatchPost> {
    const result: { insertId: number } = await this.dataSource.query(
      `INSERT INTO match_posts
         (creator_id, cluster_id, play_date, start_time, end_time, skill_level, players_needed, description)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        data.creatorId,
        data.clusterId,
        data.playDate,
        data.startTime,
        data.endTime,
        data.skillLevel,
        data.playersNeeded,
        data.description ?? null,
      ],
    );
    return (await this.findPostById(result.insertId)) as MatchPost;
  }

  async findPosts(filter: MatchFilter): Promise<MatchPost[]> {
    const where: string[] = ["p.status <> 'CANCELLED'", 'p.play_date >= CURDATE()'];
    const params: unknown[] = [];
    if (filter.skillLevel !== undefined) {
      where.push('p.skill_level = ?');
      params.push(filter.skillLevel);
    }
    if (filter.clusterId !== undefined) {
      where.push('p.cluster_id = ?');
      params.push(filter.clusterId);
    }
    const rows: Record<string, unknown>[] = await this.dataSource.query(
      `${SELECT_POST} WHERE ${where.join(' AND ')} ORDER BY p.play_date, p.start_time`,
      params,
    );
    return rows.map(toPost);
  }

  async findPostById(postId: number): Promise<MatchPost | null> {
    const rows: Record<string, unknown>[] = await this.dataSource.query(
      `${SELECT_POST} WHERE p.post_id = ?`,
      [postId],
    );
    return rows.length === 0 ? null : toPost(rows[0]);
  }

  async join(postId: number, userId: number): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      // FOR UPDATE: 2 nguoi cung bam tham gia thi phai xep hang, tranh qua so nguoi.
      const posts: LockedPost[] = await manager.query(
        'SELECT creator_id, players_needed, status FROM match_posts WHERE post_id = ? FOR UPDATE',
        [postId],
      );
      if (posts.length === 0 || posts[0].status === 'CANCELLED') {
        throw new NotFoundDomainError(DomainErrorCode.MATCH_NOT_FOUND, 'Khong tim thay bai dang');
      }
      const post = posts[0];
      if (Number(post.creator_id) === userId) {
        throw new DomainError(DomainErrorCode.INVALID_INPUT, 'Ban la nguoi tao bai dang nay');
      }
      const joined: { user_id: number }[] = await manager.query(
        'SELECT user_id FROM match_participants WHERE post_id = ?',
        [postId],
      );
      if (joined.some((j) => Number(j.user_id) === userId)) {
        throw new ConflictError(DomainErrorCode.MATCH_ALREADY_JOINED, 'Ban da tham gia tran nay');
      }
      if (joined.length >= Number(post.players_needed)) {
        throw new ConflictError(DomainErrorCode.MATCH_FULL, 'Tran nay da du nguoi');
      }
      await manager.query('INSERT INTO match_participants (post_id, user_id) VALUES (?, ?)', [
        postId,
        userId,
      ]);
      if (joined.length + 1 >= Number(post.players_needed)) {
        await manager.query("UPDATE match_posts SET status = 'FULL' WHERE post_id = ?", [postId]);
      }
    });
  }

  async leave(postId: number, userId: number): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      await manager.query('SELECT post_id FROM match_posts WHERE post_id = ? FOR UPDATE', [postId]);
      const result: { affectedRows: number } = await manager.query(
        'DELETE FROM match_participants WHERE post_id = ? AND user_id = ?',
        [postId, userId],
      );
      if (result.affectedRows === 0) {
        throw new NotFoundDomainError(DomainErrorCode.MATCH_NOT_JOINED, 'Ban chua tham gia tran nay');
      }
      await manager.query(
        "UPDATE match_posts SET status = 'OPEN' WHERE post_id = ? AND status = 'FULL'",
        [postId],
      );
    });
  }

  async cancelPost(postId: number): Promise<void> {
    await this.dataSource.query("UPDATE match_posts SET status = 'CANCELLED' WHERE post_id = ?", [
      postId,
    ]);
  }
}