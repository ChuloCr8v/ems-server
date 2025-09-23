import { IsString, IsNumber, IsDate, IsOptional, IsEnum } from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { ClaimStatus, ClaimType } from '@prisma/client';

export class CreateClaimDto {
  @IsString()
  title: string;

  @IsString()
  claimType: ClaimType;

   @IsNumber()
  // @Transform(({ value }) => {
  //   // Convert string to number
  //   if (typeof value === 'string') {
  //     return parseFloat(value);
  //   }
  //   return value;
  // })
  amount: number;

  @IsDate()
  @Type(() => Date)
  dateOfExpense: Date;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
   uploads?: Express.Multer.File[];
}

export class UpdateClaimDto {
   @IsString()
  title: string;

  @IsString()
  claimType: ClaimType;

   @IsNumber()
  // @Transform(({ value }) => {
  //   // Convert string to number
  //   if (typeof value === 'string') {
  //     return parseFloat(value);
  //   }
  //   return value;
  // })
  amount: number;

  @IsDate()
  @Type(() => Date)
  dateOfExpense: Date;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
   uploads?: Express.Multer.File[];


  @IsOptional()
  @IsEnum(ClaimStatus)
  status?: ClaimStatus;
}


export class FileResponseDto {
  id: string;
  filename: string;
  originalName: string;
  path: string;
  mimetype: string;
  size: number;
  url: string;
}

export class ClaimResponseDto {
  id: string;
  title: string;
  claimType: ClaimType;
  amount: number;
  dateOfExpense: Date;
  description?: string;
  status: ClaimStatus;
  uploads: FileResponseDto[];
  userId: string;
  user?: {
    id: string;
    name: string;
    email: string;
  };
  createdAt: Date;
  updatedAt: Date;
}