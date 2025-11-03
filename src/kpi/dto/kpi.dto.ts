import { KpiCategoryType } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsString, IsOptional, IsNumber, Min, Max, IsBoolean, IsUUID, IsArray, ValidateNested } from 'class-validator';

export class CreateKpiObjectiveDto {
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


export class CreateKpiCategoryDto {
  @IsString()
  name: string;

  @IsString()
  type: KpiCategoryType;

  @IsBoolean()
  @IsOptional()
  isGlobal?: boolean = true;

  @IsUUID()
  @IsOptional()
  departmentId?: string;

  @IsArray() 
  @ValidateNested({ each: true }) 
  @Type(() => CreateKpiObjectiveDto)
  objectives: CreateKpiObjectiveDto[];
}

export class CreateKpiDto {
  @IsArray() 
  @ValidateNested({ each: true }) 
  @Type(() => CreateKpiCategoryDto)
  categories: CreateKpiCategoryDto[];
}