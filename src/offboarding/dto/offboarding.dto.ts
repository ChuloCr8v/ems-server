import { ExitType } from '@prisma/client';
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
} from 'class-validator';

export class InitiateExit {
  @IsEnum(ExitType, {
    each: true,
    message: 'Exit Type must be one of the following: RESIGNATION, TERMINATION',
  })
  @IsNotEmpty()
  type: ExitType;

  @IsString()
  @IsNotEmpty()
  reason: string;

  @IsString()
  @IsNotEmpty()
  relievingDate: Date;

  @IsString()
  @IsNotEmpty()
  resignationDate: Date;

  @IsBoolean()
  @IsNotEmpty()
  noticePeriod?: boolean;

  @IsOptional()
  @IsArray()
  uploads?: string[];
}

export class DepartmentClearanceDto {}

// export class ReturnAsset {
//     @IsString()
//     @IsNotEmpty()
//     condition: string;

//     @IsString()
//     @IsNotEmpty()
//     reason: string;
// }

// export class ReportAssetDto {
//     @IsString()
//     @IsNotEmpty()
//     comment: string;
// }

// export class DebtPaymentDto {
//     @IsString()
//     @IsOptional()
//     notes?: string;

//     @IsArray()
//     @IsOptional()
//     uploads?: string[];

// }

// export class NotesDto {
//     @IsString()
//     @IsOptional()
//     notes?: string;

//     @IsArray()
//     @IsOptional()
//     uploads?: string[];

// }

// export class CommentsDto {
//     @IsString()
//     @IsOptional()
//     comments: string;

//     @IsArray()
//     @IsOptional()
//     uploads?: string[];

// }
