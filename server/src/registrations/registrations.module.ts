import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Race, RaceGroup, Registration, RiderProfile, User } from '../entities';
import { RegistrationsController } from './registrations.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Registration, Race, RaceGroup, RiderProfile, User])],
  controllers: [RegistrationsController],
})
export class RegistrationsModule {}
