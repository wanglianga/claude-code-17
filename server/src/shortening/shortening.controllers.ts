import {
  Body,
  Controller,
  Get,
  Param,
  Post,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { IsArray, IsIn, IsNotEmpty, IsNumber, IsOptional, IsString } from 'class-validator';
import { Type } from 'class-transformer';
import { Role, ShorteningTask, StageShortening } from '../entities';
import { CurrentUser, Roles } from '../auth/guards';
import { ShorteningService } from './shortening.service';

// ---------------- 天气预警 ----------------

class AlertDto {
  @IsIn(['WIND', 'RAIN', 'HEAT']) kind: string;
  @IsIn(['INFO', 'WARNING', 'CRITICAL']) @IsOptional() severity?: string;
  @IsString() @IsNotEmpty() raceId: string;
  @IsString() @IsNotEmpty() title: string;
  @IsString() @IsOptional() description?: string;
  @IsString() @IsNotEmpty() issuedAt: string; // HH:mm
  @IsString() @IsNotEmpty() effectiveUntil: string; // HH:mm
  @Type(() => Number) @IsNumber() @IsOptional() affectedFromKm?: number;
  @Type(() => Number) @IsNumber() @IsOptional() affectedToKm?: number;
  @IsArray() @IsOptional() groupIds?: string[];
}

@Controller('weather-alerts')
export class WeatherAlertsController {
  constructor(private svc: ShorteningService) {}

  /** 运营收到大风/暴雨/高温预警并录入（同时生成天气事件通知各岗位） */
  @Roles(Role.OPS)
  @Post()
  create(@Body() dto: AlertDto, @CurrentUser() user: any) {
    return this.svc.createAlert(dto, user);
  }

  @Get('race/:raceId')
  list(@Param('raceId') raceId: string) {
    return this.svc.listAlerts(raceId);
  }
}

// ---------------- 评估 / 方案 / 裁判确认 ----------------

class AssessDto {
  @IsString() @IsNotEmpty() alertId: string;
  @IsString() @IsOptional() now?: string; // HH:mm，演示用：指定"当前时间"
}

class ProposeDto {
  @IsString() @IsNotEmpty() alertId: string;
  @IsString() @IsNotEmpty() newFinishPointId: string; // 关键路口
  // 每组关门时间覆盖：{ [groupId]: "HH:mm" }
  @IsOptional() cutoffByGroup?: Record<string, string>;
  @IsArray() @IsOptional() groupIds?: string[];
}

@Controller('shortenings')
export class ShorteningsController {
  constructor(
    private svc: ShorteningService,
    @InjectRepository(StageShortening) private repo: Repository<StageShortening>,
  ) {}

  /** 平台评估：各组选手位置 / 补给消耗 / 医疗容量 / 管制剩余 → 建议关键路口与关门时间 */
  @Roles(Role.OPS, Role.REFEREE)
  @Post('assess')
  assess(@Body() dto: AssessDto) {
    const now = dto.now ? new Date(`2000-01-01T${dto.now}:00`) : new Date();
    return this.svc.assess(dto.alertId, now);
  }

  /** 运营提交缩短方案（待裁判确认） */
  @Roles(Role.OPS)
  @Post()
  propose(@Body() dto: ProposeDto, @CurrentUser() user: any) {
    return this.svc.propose(dto, user);
  }

  @Get('race/:raceId')
  async list(@Param('raceId') raceId: string) {
    return this.svc.listForRace(raceId);
  }

  /** 裁判确认：下发关门时间、通知岗位/选手、成绩分类、重生成任务、标记未通知岗位 */
  @Roles(Role.REFEREE)
  @Post(':id/confirm')
  confirm(@Param('id') id: string, @Body('note') note: string, @CurrentUser() user: any) {
    return this.svc.confirm(id, user, note || '');
  }

  /** 关门核验：未通过关键路口选手在新终点的过点记录 → 关门前=关门点成绩，超时=DNF */
  @Roles(Role.REFEREE, Role.OPS)
  @Post(':id/verify-cutoff')
  verify(
    @Param('id') id: string,
    @Body() body: { registrationId?: string; markMissed?: boolean },
    @CurrentUser() user: any,
  ) {
    return this.svc.verifyCutoff(id, user, {
      regId: body?.registrationId,
      readAt: body?.registrationId ? new Date() : undefined,
      markMissed: body?.markMissed,
    });
  }

  /** 岗位签收新关门时间（补给点/计时点/医疗/志愿者） */
  @Roles(Role.SUPPLY, Role.VOLUNTEER, Role.MEDICAL, Role.CHECKIN, Role.OPS, Role.REFEREE)
  @Post(':id/ack-post')
  ack(@Param('id') id: string, @Body('routePointId') routePointId: string, @CurrentUser() user: any) {
    return this.svc.ackPost(id, routePointId, user);
  }

  /** 任务/岗位看板：任务单、岗位通知与签收状态、未接到通知岗位 */
  @Get('race/:raceId/board')
  board(@Param('raceId') raceId: string, @CurrentUser() user: any) {
    return this.svc.taskBoard(raceId).then((b) => ({ ...b, viewerRole: user.role }));
  }
}

// ---------------- 重生成任务 ----------------

@Controller('shortening-tasks')
export class ShorteningTasksController {
  constructor(
    private svc: ShorteningService,
    @InjectRepository(ShorteningTask) private repo: Repository<ShorteningTask>,
  ) {}

  /** 当前岗位的任务（按角色过滤；OPS/REFEREE 看全部） */
  @Get('race/:raceId/mine')
  async mine(@Param('raceId') raceId: string, @CurrentUser() user: any) {
    const board = await this.svc.taskBoard(raceId);
    const tasks = board.tasks as ShorteningTask[];
    if ([Role.OPS, Role.REFEREE].includes(user.role)) return tasks;
    return tasks.filter((t) => t.targetRole === user.role);
  }

  /** 完成任务（物资前移 / 接驳 / 站位 / 紧急封路） */
  @Roles(Role.SUPPLY, Role.VOLUNTEER, Role.OPS, Role.REFEREE)
  @Post(':id/complete')
  complete(@Param('id') id: string, @Body('note') note: string, @CurrentUser() user: any) {
    return this.svc.completeTask(id, user, note || '');
  }
}
