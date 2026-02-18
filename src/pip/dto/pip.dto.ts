import { Type } from 'class-transformer';
import {
  IsArray,
  IsDate,
  IsNumber,
  IsOptional,
  IsString,
} from 'class-validator';

export class CreatePipDto {
  @IsString()
  title: string;

  @IsString()
  platform: string;

  @IsString()
  url: string;

  @IsDate()
  @Type(() => Date)
  startDate: Date;

  @IsDate()
  @Type(() => Date)
  endDate: Date;

  @IsString()
  duration: string;

  @IsNumber()
  cost: number;

  @IsString()
  reason: string;

  @IsOptional()
  @IsArray()
  uploads?: string[];

  @IsString()
  @IsOptional()
  rPId?: string;
}

export class RecommendPipDto {
  @IsString()
  teamMemberId: string;

  @IsString()
  aoi: string;

  @IsString()
  comment: string;

  @IsOptional()
  @IsArray()
  uploads?: string[];
}

export class ApprovePipDto {
  @IsString()
  @IsOptional()
  comment?: string;

  @IsOptional()
  @IsArray()
  uploads?: string[];
}

export class RejectPipDto {
  @IsString()
  reason: string;

  @IsOptional()
  @IsArray()
  uploads?: string[];

  @IsString()
  aoi: string;
}

export class MarkPipAsCompletedDto {
  @IsString()
  comment: string;

  @IsOptional()
  @IsArray()
  uploads?: string[];
}

// export class ClaimPipDto {
//   @IsString()
//   title: string;

//   @IsNumber()
//   amount: number;

//   @IsDate()
//   @Type(() => Date)
//   dateOfExpense: Date;

//   @IsString()
//   de
// }
