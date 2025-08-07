import { IsEnum, IsNotEmpty, IsOptional, IsUUID, IsDateString } from 'class-validator';
import { AssetCategory, AssetStatus } from '@prisma/client';

export class CreateAssetDto {
  @IsNotEmpty()
  name: string;

  @IsEnum(AssetCategory)
  category: AssetCategory;

  @IsEnum(AssetStatus)
  status: AssetStatus;

  @IsDateString()
  dateAssigned: string;

  @IsOptional()
  @IsDateString()
  dateRetrieved?: string;

  @IsUUID()
  assignedToId: string;
}
