import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  NotFoundException,
  Param,
  Post,
  Put,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import {
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import {
  PointType,
  Race,
  RaceGroup,
  RaceRoute,
  RaceStatus,
  Registration,
  RegStatus,
  RiderProfile,
  Role,
  RoutePoint,
  RoutePointGroup,
  TimelineType,
  CheckIn,
  User,
} from '../entities';
import { CurrentUser, Roles } from '../auth/guards';
import { TimelineService } from '../timeline/timeline.module';

class RaceDto {
  @IsString() @IsNotEmpty() name: string;
  @IsString() @IsOptional() description?: string;
  @IsString() @IsNotEmpty() raceDate: string;
  @IsString() @IsOptional() location?: string;
}

class GroupDto {
  @IsString() @IsNotEmpty() name: string;
  @IsString() @IsNotEmpty() code: string;
  @Type(() => Number) @IsInt() @Min(0) minAge: number;
  @Type(() => Number) @IsInt() @Min(0) maxAge: number;
  @IsArray() allowedVehicleTypes: string[];
  @Type(() => Number) @IsInt() @Min(0) minExperienceYears: number;
  @Type(() => Number) @IsInt() @Min(1) capacity: number;
  @IsBoolean() requiresInsurance: boolean;
  @IsIn(['LOW', 'MEDIUM', 'HIGH']) maxMedicalRisk: string;
  @IsString() @IsOptional() startTime?: string;
  @Type(() => Number) @IsInt() @IsOptional() sortOrder?: number;
}

class RouteDto {
  @IsString() @IsNotEmpty() name: string;
  @Type(() => Number) distanceKm: number;
  @IsString() @IsOptional() notes?: string;
}

class PointDto {
  @IsIn(Object.values(PointType)) type: PointType;
  @IsString() @IsNotEmpty() name: string;
  @Type(() => Number) kmMark: number;
  @Type(() => Number) @IsInt() @IsOptional() sequence?: number;
  @IsString() @IsOptional() description?: string;
  @IsString() @IsOptional() trafficControlStart?: string;
  @IsString() @IsOptional() trafficControlEnd?: string;
  @Type(() => Number) @IsInt() @IsOptional() waterStock?: number;
  @Type(() => Number) @IsInt() @IsOptional() gelStock?: number;
  @Type(() => Number) @IsInt() @IsOptional() partsStock?: number;
  @IsArray() @IsOptional() groupIds?: string[]; // 关联组别（空=全部）
}

const TRANSITIONS: Record<RaceStatus, RaceStatus[]> = {
  [RaceStatus.DRAFT]: [RaceStatus.REGISTRATION_OPEN],
  [RaceStatus.REGISTRATION_OPEN]: [RaceStatus.REGISTRATION_CLOSED],
  [RaceStatus.REGISTRATION_CLOSED]: [RaceStatus.RACE_DAY],
  [RaceStatus.RACE_DAY]: [RaceStatus.FINISHED],
  [RaceStatus.FINISHED]: [RaceStatus.ARCHIVED],
  [RaceStatus.ARCHIVED]: [],
};

@Controller('races')
export class RacesController {
  constructor(
    @InjectRepository(Race) private races: Repository<Race>,
    @InjectRepository(RaceGroup) private groups: Repository<RaceGroup>,
    @InjectRepository(RaceRoute) private routes: Repository<RaceRoute>,
    @InjectRepository(RoutePoint) private points: Repository<RoutePoint>,
    @InjectRepository(RoutePointGroup) private pointGroups: Repository<RoutePointGroup>,
    @InjectRepository(Registration) private registrations: Repository<Registration>,
    @InjectRepository(CheckIn) private checkIns: Repository<CheckIn>,
    private timeline: TimelineService,
  ) {}

  // ---------- 赛事 ----------

  @Get()
  async list() {
    const races = await this.races.find({ order: { raceDate: 'DESC' } });
    const result = [];
    for (const r of races) {
      const groups = await this.groups.find({ where: { raceId: r.id } });
      const regs = await this.registrations.count({ where: { raceId: r.id } });
      result.push({ ...r, groupCount: groups.length, registrationCount: regs });
    }
    return result;
  }

  @Roles(Role.OPS)
  @Post()
  async create(@Body() dto: RaceDto, @CurrentUser() user: any) {
    const race = await this.races.save(this.races.create({ ...dto, status: RaceStatus.DRAFT }));
    await this.timeline.add(race.id, TimelineType.RACE_STATUS, `赛事「${race.name}」创建`, {
      actorId: user.id,
      actorName: user.displayName,
    });
    return race;
  }

  @Get(':id')
  async detail(@Param('id') id: string) {
    const race = await this.races.findOne({ where: { id } });
    if (!race) throw new NotFoundException('赛事不存在');
    const groups = await this.groups.find({ where: { raceId: id }, order: { sortOrder: 'ASC' } });
    const routes = await this.routes.find({ where: { raceId: id } });
    const routeDetails = [];
    for (const route of routes) {
      const pts = await this.points.find({ where: { routeId: route.id }, order: { sequence: 'ASC' } });
      const links = pts.length
        ? await this.pointGroups.find({ where: { routePointId: In(pts.map((p) => p.id)) } })
        : [];
      routeDetails.push({
        ...route,
        points: pts.map((p) => ({
          ...p,
          groupIds: links.filter((l) => l.routePointId === p.id).map((l) => l.groupId),
        })),
      });
    }
    // 每个组别的报名统计
    const groupStats = [];
    for (const g of groups) {
      const approved = await this.registrations.count({ where: { groupId: g.id, status: RegStatus.APPROVED } });
      const waitlisted = await this.registrations.count({ where: { groupId: g.id, status: RegStatus.WAITLISTED } });
      groupStats.push({ ...g, approvedCount: approved, waitlistedCount: waitlisted });
    }
    return { ...race, groups: groupStats, routes: routeDetails };
  }

  @Roles(Role.OPS)
  @Post(':id/status')
  async changeStatus(@Param('id') id: string, @Body('status') status: RaceStatus, @CurrentUser() user: any) {
    const race = await this.races.findOne({ where: { id } });
    if (!race) throw new NotFoundException('赛事不存在');
    const allowed = TRANSITIONS[race.status] || [];
    if (!allowed.includes(status)) {
      throw new BadRequestException(`当前状态不允许流转到 ${status}，允许：${allowed.join(', ') || '无'}`);
    }
    if (status === RaceStatus.RACE_DAY) {
      const confirmed = await this.routes.count({ where: { raceId: id, status: 'CONFIRMED' } });
      if (!confirmed) throw new BadRequestException('进入比赛日前必须先确认路线');
    }
    race.status = status;
    await this.races.save(race);
    await this.timeline.add(id, TimelineType.RACE_STATUS, `赛事状态变更为 ${status}`, {
      actorId: user.id,
      actorName: user.displayName,
    });
    return race;
  }

  // ---------- 组别 ----------

  @Roles(Role.OPS)
  @Post(':id/groups')
  async addGroup(@Param('id') id: string, @Body() dto: GroupDto) {
    const group = await this.groups.save(this.groups.create({ ...dto, raceId: id, sortOrder: dto.sortOrder ?? 0 }));
    return group;
  }

  @Roles(Role.OPS)
  @Put('groups/:groupId')
  async updateGroup(@Param('groupId') groupId: string, @Body() dto: GroupDto) {
    const group = await this.groups.findOne({ where: { id: groupId } });
    if (!group) throw new NotFoundException('组别不存在');
    Object.assign(group, dto);
    return this.groups.save(group);
  }

  @Roles(Role.OPS)
  @Delete('groups/:groupId')
  async deleteGroup(@Param('groupId') groupId: string) {
    const used = await this.registrations.count({ where: { groupId } });
    if (used) throw new BadRequestException('该组别已有报名，不能删除');
    await this.groups.delete(groupId);
    return { ok: true };
  }

  // ---------- 路线与点位 ----------

  @Roles(Role.OPS)
  @Post(':id/routes')
  async addRoute(@Param('id') id: string, @Body() dto: RouteDto) {
    return this.routes.save(this.routes.create({ ...dto, raceId: id, status: 'DRAFT' }));
  }

  @Roles(Role.OPS)
  @Post('routes/:routeId/confirm')
  async confirmRoute(@Param('routeId') routeId: string, @CurrentUser() user: any) {
    const route = await this.routes.findOne({ where: { id: routeId } });
    if (!route) throw new NotFoundException('路线不存在');
    if (route.status === 'CONFIRMED') throw new BadRequestException('路线已确认');
    const pts = await this.points.count({ where: { routeId } });
    if (!pts) throw new BadRequestException('路线还没有任何点位，无法确认');
    const hasStart = await this.points.findOne({ where: { routeId, type: PointType.START } });
    const hasFinish = await this.points.findOne({ where: { routeId, type: PointType.FINISH } });
    if (!hasStart || !hasFinish) throw new BadRequestException('路线必须至少包含起点和终点');
    route.status = 'CONFIRMED';
    route.confirmedById = user.id;
    route.confirmedAt = new Date();
    await this.routes.save(route);
    await this.timeline.add(route.raceId, TimelineType.ROUTE_CONFIRMED, `路线「${route.name}」已确认（${route.distanceKm}km，${pts} 个点位）`, {
      actorId: user.id,
      actorName: user.displayName,
      refType: 'route',
      refId: route.id,
    });
    return route;
  }

  @Roles(Role.OPS)
  @Post('routes/:routeId/points')
  async addPoint(@Param('routeId') routeId: string, @Body() dto: PointDto) {
    const route = await this.routes.findOne({ where: { id: routeId } });
    if (!route) throw new NotFoundException('路线不存在');
    if (route.status === 'CONFIRMED') throw new BadRequestException('路线已确认，不能再修改点位');
    const { groupIds, ...data } = dto;
    const point = await this.points.save(this.points.create({ ...data, routeId }));
    await this.setPointGroups(point.id, groupIds || []);
    return { ...point, groupIds: groupIds || [] };
  }

  @Roles(Role.OPS)
  @Put('points/:pointId')
  async updatePoint(@Param('pointId') pointId: string, @Body() dto: PointDto) {
    const point = await this.points.findOne({ where: { id: pointId } });
    if (!point) throw new NotFoundException('点位不存在');
    const route = await this.routes.findOne({ where: { id: point.routeId } });
    if (route?.status === 'CONFIRMED') throw new BadRequestException('路线已确认，不能再修改点位');
    const { groupIds, ...data } = dto;
    Object.assign(point, data);
    await this.points.save(point);
    if (groupIds !== undefined) await this.setPointGroups(pointId, groupIds);
    return point;
  }

  @Roles(Role.OPS)
  @Delete('points/:pointId')
  async deletePoint(@Param('pointId') pointId: string) {
    const point = await this.points.findOne({ where: { id: pointId } });
    if (!point) throw new NotFoundException('点位不存在');
    const route = await this.routes.findOne({ where: { id: point.routeId } });
    if (route?.status === 'CONFIRMED') throw new BadRequestException('路线已确认，不能再删除点位');
    await this.pointGroups.delete({ routePointId: pointId });
    await this.points.delete(pointId);
    return { ok: true };
  }

  private async setPointGroups(pointId: string, groupIds: string[]) {
    await this.pointGroups.delete({ routePointId: pointId });
    for (const gid of groupIds) {
      await this.pointGroups.save(this.pointGroups.create({ routePointId: pointId, groupId: gid }));
    }
  }

  // ---------- 报名名单（运营/检录/裁判查看） ----------

  @Get(':id/registrations')
  async raceRegistrations(@Param('id') id: string, @CurrentUser() user: any) {
    if ([Role.RIDER].includes(user.role)) throw new ForbiddenException('无权查看全部报名');
    const regs = await this.registrations.find({ where: { raceId: id }, order: { submittedAt: 'ASC' } });
    return this.enrichRegistrations(regs);
  }

  @Get(':id/start-queue')
  async startQueue(@Param('id') id: string) {
    // 发车队列：仅检录通过的选手可进入
    const regs = await this.registrations.find({ where: { raceId: id, status: RegStatus.APPROVED } });
    const enriched = await this.enrichRegistrations(regs);
    const passed: any[] = [];
    for (const r of enriched) {
      const ci = await this.checkIns.findOne({ where: { registrationId: r.id } });
      if (ci?.status === 'PASSED') passed.push({ ...r, checkIn: ci });
    }
    const order = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
    passed.sort((a, b) => {
      const ga = order.indexOf(a.group?.code) === -1 ? 99 : order.indexOf(a.group?.code);
      const gb = order.indexOf(b.group?.code) === -1 ? 99 : order.indexOf(b.group?.code);
      return ga - gb || a.bibNumber.localeCompare(b.bibNumber);
    });
    return passed;
  }

  private async enrichRegistrations(regs: Registration[]) {
    const userRepo = this.registrations.manager.getRepository(User);
    const profileRepo = this.registrations.manager.getRepository(RiderProfile);
    const result = [];
    for (const r of regs) {
      const group = await this.groups.findOne({ where: { id: r.groupId } });
      const rider = await userRepo.findOne({ where: { id: r.riderId } });
      const profile = await profileRepo.findOne({ where: { userId: r.riderId } });
      const checkIn = await this.checkIns.findOne({ where: { registrationId: r.id } });
      result.push({
        ...r,
        group: group ? { id: group.id, name: group.name, code: group.code } : null,
        rider: rider ? { id: rider.id, username: rider.username, displayName: rider.displayName } : null,
        profile: profile || null,
        checkIn: checkIn || null,
      });
    }
    return result;
  }
}
