import { IsString, IsNumber, IsDate, IsOptional, IsEnum, IsArray, isString } from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { ClaimStatus, Entitlement } from '@prisma/client';
import { PartialType } from '@nestjs/mapped-types';

export class CreateClaimDto {
  @IsString()
  title: string;

  @Type(() => Number)
  @IsNumber()
  amount: number;

  @IsDate()
  @Type(() => Date)
  dateOfExpense: Date;

  @IsString()
  @Type(() => String)
  entitlement: string;

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
  entitlement: Entitlement;
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