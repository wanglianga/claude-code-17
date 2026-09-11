import { Controller, Get, Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ALL_ENTITIES } from './entities';
import { AuthModule } from './auth/auth.module';
import { JwtAuthGuard, Public, RolesGuard } from './auth/guards';
import { TimelineModule } from './timeline/timeline.module';
import { RacesModule } from './races/races.module';
import { RegistrationsModule } from './registrations/registrations.module';
import { RaceDayModule } from './raceday/raceday.module';
import { PostRaceModule } from './postrace/postrace.module';
import { ProfileModule } from './profile/profile.module';
import { SeedModule } from './seed/seed.module';

@Controller()
class HealthController {
  @Public()
  @Get('health')
  health() {
    return { status: 'ok', service: 'race-platform-api', time: new Date().toISOString() };
  }
}

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432', 10),
      username: process.env.DB_USER || 'race',
      password: process.env.DB_PASSWORD || 'race123',
      database: process.env.DB_NAME || 'racedb',
      entities: ALL_ENTITIES,
      synchronize: true, // 演示工程：自动建表
    }),
    TimelineModule,
    AuthModule,
    ProfileModule,
    RacesModule,
    RegistrationsModule,
    RaceDayModule,
    PostRaceModule,
    SeedModule,
  ],
  controllers: [HealthController],
  providers: [
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}
