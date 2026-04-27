import { KpiCategoryType } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsString,
  IsOptional,
  IsNumber,
  Min,
  Max,
  IsBoolean,
  IsUUID,
  IsArray,
  ValidateNested,
} from 'class-validator';

export class CreateCompetencyObjectiveDto {
  @IsString()
  name: string;

  @IsNumber()
  @IsOptional()
  @Min(1)
  @Max(5)
  rating?: number;

  @IsString()
  @IsOptional()
  comment?: string;

  @IsString()
  @IsOptional()
  categoryId?: string;
}

export class CreateCompetencyCategoryDto {
  @IsString()
  name: string;

  @IsString()
  @IsOptional()
  type?: KpiCategoryType;

  @IsBoolean()
  @IsOptional()
  isGlobal?: boolean = true;

  @IsUUID()
  @IsOptional()
  departmentId?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateCompetencyObjectiveDto)
  objectives: CreateCompetencyObjectiveDto[];
}

export class CreateCompetencyDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateCompetencyCategoryDto)
  categories: CreateCompetencyCategoryDto[];
}
