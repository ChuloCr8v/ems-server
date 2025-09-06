import { IsString, IsNumber, IsDate, IsOptional, IsEnum } from 'class-validator';
import { Type } from 'class-transformer';
import { ClaimStatus } from '@prisma/client';

export class CreateClaimDto {
  @IsString()
  title: string;

  @IsString()
  claimType: string;

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
  proofUrl?: string;
}

export class UpdateClaimDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  claimType?: string;

  @IsOptional()
  @IsNumber()
  amount?: number;

  @IsOptional()
  @IsDate()
  @Type(() => Date)
  dateOfExpense?: Date;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  proofUrl?: string;

  @IsOptional()
  @IsEnum(ClaimStatus)
  status?: ClaimStatus;
}