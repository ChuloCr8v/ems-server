import { IsString, IsNumber, IsDate, IsOptional, IsEnum, IsArray } from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { ClaimStatus, ClaimType } from '@prisma/client';
import { PartialType } from '@nestjs/mapped-types';

export class CreateClaimDto {
  @IsString()
  title: string;

  @IsString()
  claimType: string;

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
  @IsArray()
  proofUrls?: string[];
}
export class UpdateClaimDto extends PartialType(CreateClaimDto) {
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