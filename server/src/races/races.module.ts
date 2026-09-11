import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  CheckIn,
  Race,
  RaceGroup,
  RaceRoute,
  Registration,
  RoutePoint,
  RoutePointGroup,
} from '../entities';
import { RacesController } from './races.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([Race, RaceGroup, RaceRoute, RoutePoint, RoutePointGroup, Registration, CheckIn]),
  ],
  controllers: [RacesController],
})
export class RacesModule {}
