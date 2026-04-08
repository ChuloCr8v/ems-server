import { AAStatus, ExitType, SignatureRole } from '@prisma/client';
import {
  IsArray,
  IsBoolean,
  IsEnum,
  isNotEmpty,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
} from 'class-validator';

export class InitiateExit {
  @IsString()
  @IsNotEmpty()
  employeeId: string;

  @IsEnum(ExitType, { each: true, message: 'Exit Type must be one of the following: RESIGNATION, TERMINATION' })
  @IsNotEmpty()
  type: ExitType;

  @IsString()
  @IsNotEmpty()
  reason: string;

  @IsString()
  @IsOptional()
  relievingDate?: Date;

  @IsString()
  @IsOptional()
  resignationDate?: Date;

  @IsBoolean()
  @IsOptional()
  noticePeriod?: boolean;

  @IsOptional()
  @IsArray()
  uploads?: string[];
}

export class HandoverTaskDto {
    @IsString()
    @IsNotEmpty()
    toUserId: string;

    @IsString()
    fileLink: string;

    @IsString()
    fileName: string;

    @IsString()
    @IsOptional()
    note?: string;

    @IsString()
    @IsNotEmpty()
    signatureId: string;
}

export class DepartmentClearanceDto {
    @IsString()
    @IsNotEmpty()
    signatureId: string;

    @IsOptional()
    @IsString()
    notes?: string;
}

export class UploadHandoverSignatureDto {
    @IsString()
    @IsNotEmpty()
    signatureId: string;
}

export class FinanceClearanceDto {
  @IsBoolean()
  @IsNotEmpty()
  isLoan: boolean;

  @IsOptional()
  @IsNumber()
  loanAmount: number;

  @IsBoolean()
  @IsNotEmpty()
  isTravel: boolean;

  @IsOptional()
  @IsNumber()
  travelAmount: number;

  @IsBoolean()
  @IsNotEmpty()
  isReimbursement: boolean;

  @IsOptional()
  @IsNumber()
  reimburseAmount: number;
  
  @IsString()
  @IsOptional()
  comment?: string;
} 

export class BulkReturnDto {
  @IsArray()
  @IsNotEmpty({ each: true })
  assignmentIds: string[];
}

export class ReportAssetDto {
  @IsEnum(AAStatus)
  @IsNotEmpty()
  status: AAStatus;

  @IsNumber()
  @IsNotEmpty()
  liabilityCost: number;

  @IsString()
  @IsOptional()
  description?: string;
}

export class SignDto {
  @IsString()
  @IsNotEmpty()
  clearanceId: string;

  @IsEnum(SignatureRole)
  @IsNotEmpty()
  role: SignatureRole;

  @IsString()
  @IsNotEmpty()
  uploadId: string;
}
