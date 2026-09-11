import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { Injectable } from '@nestjs/common';
import { Repository } from 'typeorm';
import { RaceGroup, TimelineEntry, TimelineType } from '../entities';

@Injectable()
export class TimelineService {
  constructor(
    @InjectRepository(TimelineEntry) private entries: Repository<TimelineEntry>,
    @InjectRepository(RaceGroup) private groups: Repository<RaceGroup>,
  ) {}

  /** 追加一条时间轴记录（赛事当天所有决定/事件/通知都进入同一时间轴） */
  async add(
    raceId: string,
    type: TimelineType,
    message: string,
    opts: {
      actorId?: string;
      actorName?: string;
      groupIds?: string[];
      refType?: string;
      refId?: string;
      createdAt?: Date;
    } = {},
  ) {
    const entry = this.entries.create({
      raceId,
      type,
      message,
      actorId: opts.actorId || null,
      actorName: opts.actorName || '',
      affectedGroupIds: opts.groupIds && opts.groupIds.length ? opts.groupIds : null,
      refType: opts.refType || null,
      refId: opts.refId || null,
    });
    if (opts.createdAt) (entry as any).createdAt = opts.createdAt;
    return this.entries.save(entry);
  }

  /** 查询时间轴；可按组别过滤 —— 赛后申诉时还原"每个决定影响了哪些组别" */
  async list(raceId: string, groupId?: string) {
    const entries = await this.entries.find({
      where: { raceId },
      order: { createdAt: 'ASC', id: 'ASC' },
    });
    const groups = await this.groups.find({ where: { raceId } });
    const nameOf = (id: string) => groups.find((g) => g.id === id)?.name || id;
    const enriched = entries.map((e) => ({
      ...e,
      affectedGroups: (e.affectedGroupIds || []).map((id) => ({ id, name: nameOf(id) })),
    }));
    if (!groupId) return enriched;
    return enriched.filter(
      (e) => !e.affectedGroupIds || e.affectedGroupIds.length === 0 || e.affectedGroupIds.includes(groupId),
    );
  }
}

@Global()
@Module({
  imports: [TypeOrmModule.forFeature([TimelineEntry, RaceGroup])],
  providers: [TimelineService],
  exports: [TimelineService],
})
export class TimelineModule {}
