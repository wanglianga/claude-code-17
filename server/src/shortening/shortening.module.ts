import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  CheckIn,
  ChipRecord,
  MedicalRecord,
  Notification,
  Race,
  RaceEvent,
  RaceGroup,
  RaceResult,
  RaceRoute,
  Registration,
  Role,
  RoutePoint,
  ShorteningTask,
  StageShortening,
  SupplyRecord,
  User,
  WeatherAlert,
  Withdrawal,
} from '../entities';
import {
  ShorteningsController,
  ShorteningTasksController,
  WeatherAlertsController,
} from './shortening.controllers';
import { ShorteningService } from './shortening.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      WeatherAlert,
      StageShortening,
      ShorteningTask,
      Race,
      RaceGroup,
      RaceRoute,
      RoutePoint,
      Registration,
      CheckIn,
      ChipRecord,
      SupplyRecord,
      MedicalRecord,
      RaceResult,
      Withdrawal,
      Notification,
      RaceEvent,
      User,
    ]),
  ],
  controllers: [WeatherAlertsController, ShorteningsController, ShorteningTasksController],
  providers: [ShorteningService],
  exports: [ShorteningService],
})
export class ShorteningModule {}
