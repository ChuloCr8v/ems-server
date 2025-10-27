import { IsString, IsNumber, IsDate, IsOptional, IsEnum } from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { ClaimStatus, ClaimType } from '@prisma/client';

export class CreateClaimDto {
  @IsString()
  title: string;

  @IsString()
  claimId: string;

  @IsEnum(ClaimType)
  claimType: ClaimType;

  @Type(() => Number)
  @IsNumber()
  amount: number;

  @IsDate()
  @Type(() => Date)
  dateOfExpense: Date;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  proofUrls?: string[]; // <-- array of file IDs
}

export class UpdateClaimDto {
   @IsString()
  title: string;

   @IsString()
  claimId: string;

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
  proofUrls?: string[]; // <-- optional array for updates


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
  claimId: string;
  claimType: ClaimType;
  amount: number;
  dateOfExpense: Date;
  description?: string;
  status: ClaimStatus;
  proofUrls?: string[];
  userId: string;
  user?: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  };
  createdAt: Date;
  updatedAt: Date;
}

export class AddClaimMailDto {
  email: string;
  name: string;
  claimType: string;
  amount: number;
  dateOfExpense: Date;
  reason?: string;
  link?: string;
}

export class ApproveClaimMailDto {
  email: string;
  name: string;
  claimType: string;
  amount: number;
  dateOfExpense: Date;
}

export class RejectClaimMailDto {
  email: string;
  name: string;
  claimType: string;
  amount: number;
  dateOfExpense: Date;
  reason: string;
}
