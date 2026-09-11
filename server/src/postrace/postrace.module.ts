import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  Appeal,
  ChipRecord,
  MedicalRecord,
  Race,
  RaceEvent,
  RaceGroup,
  RaceResult,
  RaceRoute,
  Registration,
  RoutePoint,
  SupplyRecord,
  User,
  Withdrawal,
} from '../entities';
import { AppealsController, ArchiveController, TimelineController } from './postrace.controllers';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Appeal,
      ChipRecord,
      MedicalRecord,
      Race,
      RaceEvent,
      RaceGroup,
      RaceResult,
      RaceRoute,
      Registration,
      RoutePoint,
      SupplyRecord,
      User,
      Withdrawal,
    ]),
  ],
  controllers: [AppealsController, TimelineController, ArchiveController],
})
export class PostRaceModule {}
