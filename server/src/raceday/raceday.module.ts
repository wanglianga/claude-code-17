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
  RiderProfile,
  RoutePoint,
  SupplyRecord,
  User,
  Withdrawal,
} from '../entities';
import {
  CheckInsController,
  EventsController,
  InstructionsController,
  MedicalController,
  ResultsController,
  SuppliesController,
  WithdrawalsController,
} from './raceday.controllers';
import { ShorteningModule } from '../shortening/shortening.module';

@Module({
  imports: [
    ShorteningModule,
    TypeOrmModule.forFeature([
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
      RiderProfile,
      RoutePoint,
      SupplyRecord,
      User,
      Withdrawal,
    ]),
  ],
  controllers: [
    CheckInsController,
    SuppliesController,
    EventsController,
    InstructionsController,
    WithdrawalsController,
    ResultsController,
    MedicalController,
  ],
})
export class RaceDayModule {}
