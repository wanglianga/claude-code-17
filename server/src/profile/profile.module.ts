import { Body, Controller, Get, Put } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { IsBoolean, IsInt, IsNotEmpty, IsOptional, IsString, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RiderProfile, Role } from '../entities';
import { CurrentUser, Roles } from '../auth/guards';

class ProfileDto {
  @IsString() @IsNotEmpty() fullName: string;
  @IsString() @IsOptional() gender?: string;
  @IsString() @IsNotEmpty() birthDate: string;
  @IsString() @IsNotEmpty() idType: string;
  @IsString() @IsNotEmpty() idNumber: string;
  @IsString() @IsOptional() phone?: string;
  @Type(() => Number) @IsInt() @Min(0) experienceYears: number;
  @IsString() @IsNotEmpty() vehicleType: string;
  @IsString() @IsNotEmpty() emergencyContactName: string;
  @IsString() @IsNotEmpty() emergencyContactPhone: string;
  @IsBoolean() healthCommitment: boolean;
  @IsString() @IsOptional() healthConditions?: string;
  @IsString() @IsOptional() historicalResults?: string;
  @IsString() @IsOptional() insuranceProvider?: string;
  @IsString() @IsOptional() insurancePolicyNo?: string;
  @IsString() @IsOptional() insuranceValidUntil?: string;
}

@Controller('profile')
export class ProfileController {
  constructor(@InjectRepository(RiderProfile) private profiles: Repository<RiderProfile>) {}

  @Get()
  @Roles(Role.RIDER)
  async get(@CurrentUser() user: any) {
    return (await this.profiles.findOne({ where: { userId: user.id } })) || null;
  }

  @Put()
  @Roles(Role.RIDER)
  async upsert(@CurrentUser() user: any, @Body() dto: ProfileDto) {
    let profile = await this.profiles.findOne({ where: { userId: user.id } });
    if (!profile) profile = this.profiles.create({ userId: user.id });
    Object.assign(profile, dto);
    return this.profiles.save(profile);
  }
}

@Module({
  imports: [TypeOrmModule.forFeature([RiderProfile])],
  controllers: [ProfileController],
})
export class ProfileModule {}
