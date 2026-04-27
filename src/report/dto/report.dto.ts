import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { TaskStatus } from '@prisma/client';

export class CreateReportDto {
  @IsString()
  title: string;

  @IsOptional()
  @IsString()
  description?: string | null;

  @IsString()
  @IsOptional()
  taskId?: string;

  @IsString()
  @IsOptional()
  projectId?: string;
}

export class CreateDepartmentWeeklyReportDto {
  @IsString()
  title: string;

  @IsString()
  @IsOptional()
  department?: string;

  @IsInt()
  @Min(1)
  week: number;

  @IsOptional()
  @IsBoolean()
  isDraft?: boolean;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateReportDto)
  reports: CreateReportDto[];
}
