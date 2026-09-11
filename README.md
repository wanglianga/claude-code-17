# 城市骑行赛事报名分组与赛道补给管理平台

## 原始需求

> 建设城市骑行赛事报名分组与赛道补给管理平台，可采用 Next.js、NestJS 和 PostgreSQL。选手报名时提交年龄、骑行经验、证件、健康承诺、车辆类型、紧急联系人和历史成绩，平台根据组别规则、人数上限、保险要求和医疗风险生成报名状态。赛事运营确认路线后，系统把起终点、爬坡段、补给点、维修点、医疗点、计时点和交通管制时间关联到组别。检录当天，工作人员核验证件、头盔、号码牌、芯片、车辆刹车和保险；未通过检录的选手不能进入发车队列。比赛过程中，补给点记录饮水、能量胶、维修配件和选手通过情况；若某组选手大量滞留、天气突变、摔车、芯片漏读或交通管制提前解除，平台需要把信息传给裁判、医疗、补给和志愿者。退赛选手需要登记退赛位置、原因、是否需要接驳和车辆状态。完赛后，成绩、芯片记录、补给异常、医疗处置和申诉证据会进入同一条赛事档案，用于颁奖、保险和下一届路线优化。平台还要把赛事当天的裁判指令、医疗处置和选手通知保留在同一时间轴，赛后申诉时可以还原每个决定影响了哪些组别。

## 技术栈与架构

- **前端**：Next.js 14（App Router，standalone 输出），七套角色工作台
- **后端**：NestJS 10 + TypeORM（REST API，全局前缀 `/api`）
- **数据库**：PostgreSQL 16（仅 compose 内部网络，不发布宿主端口）
- **部署**：3 个服务一键 `docker compose up -d`

```
浏览器 ──► web(Next.js :3000, 唯一发布端口) ──/api/* 代理──► api(NestJS :4000) ──► db(PostgreSQL :5432)
```

前端不直连数据库与后端容器；`/api/*` 由 Next.js Route Handler 代理到内部 `api` 服务。

## 一键启动（验证方式 = 宿主 docker compose up）

```bash
cp .env.example .env   # 可选；宿主机端口由环境变量 CC_PUBLISH_PORT 提供
docker compose up -d --build
docker compose ps      # 等待 db/api/web 全部 healthy
docker compose port web 3000   # 查看实际映射端口（= $CC_PUBLISH_PORT）
# 浏览器访问 http://localhost:<端口>
# 结束验证后：
docker compose down
```

首次启动时后端自动建表并写入演示数据（两个赛事：一个「报名中」可走完整流程，一个「已归档」含完整赛事档案）。

## 测试账号（逐角色）

| 角色 | 用户名 | 密码 | 权限/工作台 |
|---|---|---|---|
| 赛事运营 | `admin` | `Admin@123` | 建赛事/组别/路线点位、确认路线、审核报名、状态流转、查看全部 |
| 裁判 | `referee` | `Referee@123` | 事件处理、发布裁判指令（进时间轴+推送选手）、申诉处理、芯片补录/成绩 |
| 医疗 | `medic` | `Medic@123` | 查看医疗相关事件、登记医疗处置（进时间轴与档案） |
| 检录员 | `checkin` | `Checkin@123` | 检录六项核验（证件/头盔/号码牌/芯片/刹车/保险）、发车队列 |
| 补给员 | `supply` | `Supply@123` | 补给点登记饮水/能量胶/配件与选手通过、库存与异常 |
| 志愿者 | `volunteer` | `Volunteer@123` | 接收岗位通知、退赛接驳任务 |
| 选手 | `rider1`~`rider8` | `Rider@123` | 资料/报名/我的报名/退赛/申诉/通知；`rider8` 未报名可现场体验报名评估 |

演示数据速览：

- **2026 城市环骑挑战赛**（报名中，60km，4 组别，9 点位）：rider1~rider6 已通过、rider7 被系统拒绝（经验不足）、rider8 未报名。
- **2025 秋季环城挑战赛**（已归档，45km）：含成绩与芯片记录、补给异常（饮水发光）、医疗处置、退赛接驳、芯片漏读事件、已处理申诉与完整时间轴。

## 需求 → 功能对照

| 原始需求 | 实现 |
|---|---|
| 报名提交年龄/经验/证件/健康承诺/车辆/紧急联系人/历史成绩 | 选手资料表 + 报名接口，缺资料不可报名 |
| 按组别规则/人数上限/保险/医疗风险生成报名状态 | 报名评估引擎：年龄区间、车辆类型、经验年限、健康承诺、保险有效期覆盖比赛日、医疗风险评分（年龄+病史关键词）→ 通过/拒绝（含原因）/满员候补；候补自动递补 |
| 路线确认后点位关联到组别 | 路线草稿→确认流转；点位类型含起终点/爬坡段/补给/维修/医疗/计时/交通管制时间；点位可关联指定组别（空=全部） |
| 检录六项核验，未通过不进发车队列 | 检录接口六项全过才 PASSED；发车队列仅含 PASSED |
| 补给点记录饮水/能量胶/配件/通过 | 补给记录 + 库存扣减；库存不足自动生成「补给异常」进时间轴并通知补给/裁判 |
| 滞留/天气/摔车/芯片漏读/管制解除 → 通知各岗位 | 事件上报按类型默认路由到裁判/医疗/补给/志愿者（可覆盖），生成岗位通知 |
| 退赛登记位置/原因/接驳/车辆状态 | 退赛接口 + 需接驳时推送志愿者；自动生成 DNF 成绩 |
| 成绩/芯片/补给异常/医疗/申诉 → 同一赛事档案 | `GET /api/archive/race/:id` 聚合档案 + 档案页 |
| 裁判指令/医疗处置/选手通知保留同一时间轴，可按组别还原 | 全部业务动作写入统一时间轴（含影响组别），时间轴页支持按组别过滤 |

## 主要 API

```
POST /api/auth/login                登录（JWT）
GET|PUT /api/profile                选手资料
POST /api/registrations             提交报名（自动评估状态）
POST /api/registrations/:id/review  运营人工审核（可覆盖系统判定）
GET  /api/races/:id                 赛事详情（组别+路线+点位+关联组别）
POST /api/races/:id/status          赛事状态流转（进入比赛日需先确认路线）
POST /api/races/routes/:id/confirm  确认路线
POST /api/checkins                  检录（六项核验）
GET  /api/checkins/race/:id/queue   发车队列（仅检录通过）
POST /api/supplies/records          补给/通过记录（库存不足→异常）
POST /api/events                    赛道事件（自动通知裁判/医疗/补给/志愿者）
POST /api/instructions              裁判指令（进时间轴+推送选手）
POST /api/withdrawals               退赛登记
POST /api/results/chips             芯片补录（终点自动算净成绩）
POST /api/results/race/:id/simulate 演示：生成模拟成绩
POST /api/medical                   医疗处置登记
POST /api/appeals                   申诉（含证据）
GET  /api/timeline/race/:id         统一时间轴（?groupId= 按组别过滤）
GET  /api/archive/race/:id          赛事档案（成绩/芯片/补给/医疗/申诉）
GET  /api/health                    健康检查
```

## 目录结构

```
├── docker-compose.yml      # db + api + web，仅 web 发布端口
├── .env.example
├── server/                 # NestJS API
│   ├── Dockerfile          # 多阶段构建，非 root，HEALTHCHECK
│   └── src/
│       ├── entities.ts     # 18 张表（用户/资料/赛事/组别/报名/路线/点位/检录/补给/事件/通知/退赛/芯片/成绩/医疗/申诉/时间轴）
│       ├── auth/           # JWT + 角色守卫
│       ├── races/          # 赛事/组别/路线点位/状态流转
│       ├── registrations/  # 报名评估引擎/人工审核/候补递补
│       ├── raceday/        # 检录/补给/事件通知/退赛/计时成绩/医疗
│       ├── postrace/       # 申诉/统一时间轴/赛事档案
│       └── seed/           # 演示数据
└── web/                    # Next.js 前端
    ├── Dockerfile          # 多阶段 standalone，非 root，HEALTHCHECK
    └── app/                # login + 7 角色工作台 + 时间轴/成绩/档案页
```

## 说明

- 数据库 Schema 由 TypeORM `synchronize` 自动创建（演示工程，未使用迁移）。
- 修改种子数据后需 `docker compose down -v` 清空数据卷再重启才会重新初始化。
