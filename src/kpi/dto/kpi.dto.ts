import { KpiCategoryType } from '@prisma/client';
import {
  IsArray,
  IsEnum,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateKpiTemplateObjectiveDto {
  @IsString()
  name: string;
}

export class CreateKpiTemplateCategoryDto {
  @IsString()
  name: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateKpiTemplateObjectiveDto)
  objectives: CreateKpiTemplateObjectiveDto[];
}

export class CreateKpiTemplateDto {
  @IsString()
  @IsOptional()
  department?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateKpiTemplateCategoryDto)
  categories: CreateKpiTemplateCategoryDto[];
}
