// src/payment/dto/paystack.dto.ts
import {
  IsString,
  IsNumber,
  IsOptional,
  Min,
  MaxLength,
  Length,
  Matches,
  IsEnum,
  IsArray,
  ValidateNested,
  IsObject,
  IsBoolean,
  IsNotEmpty,
  IsDate,
  MinLength,
} from 'class-validator';
import { Type } from 'class-transformer';

// ========== ACCOUNT VERIFICATION DTOs ==========

export class VerifyBankAccountDto {
  @IsString()
  @Length(10, 10, { message: 'Account number must be exactly 10 digits' })
  @Matches(/^\d+$/, { message: 'Account number must contain only digits' })
  accountNumber: string;

  @IsString()
  @MinLength(3, { message: 'Bank code/name must be at least 3 characters' })
  @MaxLength(50, { message: 'Bank code/name cannot exceed 50 characters' })
  bankCode: string; // This accepts both bank codes (058) AND bank names (Guaranty Trust Bank)

  @IsOptional()
  @IsString()
  notes?: string;
}

export class BankAccountResolutionDataDto {
  @IsString()
  @IsNotEmpty()
  accountNumber: string;

  @IsString()
  @IsNotEmpty()
  accountName: string;

  @IsNumber()
  bankId: number;
}

export class BankAccountResolutionResponseDto {
  @IsBoolean()
  status: boolean;

  @IsString()
  message: string;

  @IsObject()
  @ValidateNested()
  @Type(() => BankAccountResolutionDataDto)
  data: BankAccountResolutionDataDto;
}

// ========== TRANSFER RECIPIENT DTOs ==========

export class CreateTransferRecipientDto {
  @IsString()
  @IsEnum(['nuban'], { message: 'Type must be "nuban" for Nigerian accounts' })
  type: string;

  @IsString()
  @Length(2, 100, { message: 'Name must be between 2 and 100 characters' })
  name: string;

  @IsString()
  @Length(10, 10, { message: 'Account number must be 10 digits' })
  @Matches(/^\d+$/, { message: 'Account number must contain only digits' })
  accountNumber: string;

  @IsString()
  @Length(3, 10, { message: 'Bank code must be between 3 and 10 characters' })
  bankCode: string;

  @IsString()
  @IsEnum(['NGN'], { message: 'Currency must be "NGN" for Nigerian Naira' })
  currency: string = 'NGN';
}

export class TransferRecipientDetailsDto {
  @IsString()
  @IsOptional()
  accountNumber?: string;

  @IsString()
  @IsOptional()
  accountName?: string;

  @IsString()
  @IsOptional()
  bankCode?: string;

  @IsString()
  @IsOptional()
  bankName?: string;
}

export class TransferRecipientDataDto {
  @IsString()
  recipientCode: string;

  @IsString()
  type: string;

  @IsString()
  name: string;

  @IsString()
  accountNumber: string;

  @IsString()
  bankCode: string;

  @IsString()
  currency: string;

  @IsObject()
  @IsOptional()
  @ValidateNested()
  @Type(() => TransferRecipientDetailsDto)
  details?: TransferRecipientDetailsDto;
}

export class TransferRecipientResponseDto {
  @IsBoolean()
  responseStatus: boolean;

  @IsString()
  message: string;

  @IsObject()
  @ValidateNested()
  @Type(() => TransferRecipientDataDto)
  data: TransferRecipientDataDto;
}

// ========== TRANSFER INITIATION DTOs ==========

export class InitiateTransferDto {
  @IsString()
  @IsEnum(['balance'], { message: 'Source must be "balance"' })
  source: string = 'balance';

  @IsNumber()
  @Min(100, { message: 'Amount must be at least 100 kobo (₦1)' })
  amount: number; // Amount in kobo

  @IsString()
  @Length(1, 100, { message: 'Recipient code must be between 1 and 100 characters' })
  recipient: string;

  @IsString()
  @Length(1, 255, { message: 'Reason must be between 1 and 255 characters' })
  reason: string;

  @IsOptional()
  @IsString()
  reference?: string;
}

export class TransferDataDto {
  @IsString()
  reference: string;

  @IsNumber()
  integration: number;

  @IsString()
  domain: string;

  @IsNumber()
  amount: number;

  @IsString()
  currency: string;

  @IsString()
  source: string;

  @IsString()
  reason: string;

  @IsNumber()
  recipient: number;

  @IsString()
  transferStatus: string;

  @IsString()
  transferCode: string;

  @IsNumber()
  id: number;

  @IsString()
  createdAt: string;

  @IsString()
  updatedAt: string;
}

export class InitiateTransferResponseDto {
  @IsBoolean()
  responseStatus: boolean;

  @IsString()
  message: string;

  @IsObject()
  @ValidateNested()
  @Type(() => TransferDataDto)
  data: TransferDataDto;
}

// ========== TRANSFER VERIFICATION DTOs ==========

export class VerifyTransferDto {
  @IsString()
  @Length(1, 100, { message: 'Transfer reference must be between 1 and 100 characters' })
  reference: string;
}

export class TransferVerificationDataDto {
  @IsString()
  reference: string;

  @IsNumber()
  integration: number;

  @IsString()
  domain: string;

  @IsNumber()
  amount: number;

  @IsString()
  currency: string;

  @IsString()
  source: string;

  @IsString()
  reason: string;

  @IsNumber()
  recipient: number;

  @IsString()
  transferStatus: string;

  @IsString()
  transferCode: string;

  @IsNumber()
  id: number;

  @IsString()
  createdAt: string;

  @IsString()
  updatedAt: string;

  @IsObject()
  @IsOptional()
  sourceDetails?: Record<string, any>;

  @IsObject()
  @IsOptional()
  failures?: Record<string, any>;
}

export class TransferVerificationResponseDto {
  @IsBoolean()
  responseStatus: boolean;

  @IsString()
  message: string;

  @IsObject()
  @ValidateNested()
  @Type(() => TransferVerificationDataDto)
  data: TransferVerificationDataDto;
}

// ========== BANK LIST DTOs ==========

export class BankDto {
  @IsString()
  name: string;

  @IsString()
  slug: string;

  @IsString()
  code: string;

  @IsString()
  longcode: string;

  @IsString()
  @IsOptional()
  gateway: string | null;

  @IsBoolean()
  payWithBank: boolean;

  @IsBoolean()
  active: boolean;

  @IsBoolean()
  @IsOptional()
  isDeleted: boolean;

  @IsString()
  country: string;

  @IsString()
  currency: string;

  @IsString()
  type: string;
}

export class BankListResponseDto {
  @IsBoolean()
  status: boolean;

  @IsString()
  message: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BankDto)
  data: BankDto[];
}

// ========== PAYMENT PROCESSING DTOs ==========

export class ProcessPaymentDto {
  @IsString()
  @Length(3, 10, { message: 'Bank code must be between 3 and 10 characters' })
  bankCode: string;

  @IsString()
  @Length(10, 10, { message: 'Account number must be 10 digits' })
  @Matches(/^\d+$/, { message: 'Account number must contain only digits' })
  accountNumber: string;

  @IsOptional()
  @IsString()
  @Length(2, 100, { message: 'Account name must be between 2 and 100 characters' })
  accountName?: string;
}

export class PaymentResponseDto {
  @IsBoolean()
  success: boolean;

  @IsString()
  @IsOptional()
  transferReference: string | null;

  @IsString()
  @IsOptional()
  recipientCode: string | null;

  @IsString()
  message: string;

  @IsObject()
  @IsOptional()
  data?: Record<string, any>;
}

// ========== PAYMENT VERIFICATION DTOs ==========

export class PaymentVerificationDto {
  @IsString()
  @Length(1, 100, { message: 'Claim ID must be between 1 and 100 characters' })
  claimId: string;
}

export class PaymentDetailsDto {
  @IsString()
  id: string;

  @IsNumber()
  amount: number;

  @IsString()
  recipientName: string;

  @IsString()
  recipientAccountNumber: string;

  @IsString()
  recipientBankCode: string;

  @IsString()
  transferReference: string;

  @IsString()
  status: string;

  @IsDate()
  processedAt: Date;

  @IsDate()
  @IsOptional()
  verifiedAt?: Date;
}

export class PaymentDetailsResponseDto {
  @IsString()
  claimId: string;

  @IsString()
  claimStatus: string;

  @IsNumber()
  amount: number;

  @IsObject()
  @IsOptional()
  @ValidateNested()
  @Type(() => PaymentDetailsDto)
  payment?: PaymentDetailsDto;

  @IsObject()
  @IsOptional()
  verification?: Record<string, any>;
}

// ========== HELPER DTOs ==========

export class ErrorResponseDto {
  @IsBoolean()
  success: boolean;

  @IsString()
  message: string;

  @IsObject()
  @IsOptional()
  errors?: Record<string, string[]>;

  @IsString()
  @IsOptional()
  timestamp?: string;

  @IsString()
  @IsOptional()
  path?: string;
}