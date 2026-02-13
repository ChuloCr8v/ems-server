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

  @IsEnum(TaskStatus)
  status: TaskStatus;

  @IsOptional()
  @IsDateString()
  deliveryDate?: string;

  @IsUUID()
  @IsOptional()
  taskId?: string;

  @IsOptional()
  @IsBoolean()
  includeAssignees?: boolean;

  @IsOptional()
  @IsArray()
  attachments?: string[];

  @IsOptional()
  @IsString()
  comment?: string;
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
