// src/payment/payment.controller.ts
import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
  Request,
  BadRequestException,
  ValidationPipe,
  UsePipes,
} from '@nestjs/common';
import { PaystackService } from './paystack.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '@prisma/client';
import { ClaimsService } from '../claims/claims.service';
import {
  VerifyBankAccountDto,
  ProcessPaymentDto,
  BankListResponseDto,
  BankAccountResolutionResponseDto,
  PaymentResponseDto,
  PaymentDetailsResponseDto,
} from './dto/paystack.dto';
import { plainToInstance } from 'class-transformer';

@Controller('payments')
@UseGuards(JwtAuthGuard)
@UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
export class PaymentController {
  constructor(
    private readonly paystackService: PaystackService,
    private readonly claimsService: ClaimsService,
  ) {}

  @Get('banks')
  async getBanks(): Promise<BankListResponseDto> {
    try {
      const banks = await this.paystackService.getBanks();
      return plainToInstance(BankListResponseDto, {
        status: true,
        message: 'Banks retrieved successfully',
        data: banks,
      });
    } catch (error) {
      throw new BadRequestException(error.message);
    }
  }

  @Post('verify-account')
  async verifyAccount(
    @Body() verifyBankAccountDto: VerifyBankAccountDto,
  ): Promise<BankAccountResolutionResponseDto> {
    try {
      const result = await this.paystackService.resolveBankAccount(
        verifyBankAccountDto.accountNumber,
        verifyBankAccountDto.bankCode,
      );
      return result;
    } catch (error) {
      throw new BadRequestException(error.message);
    }
  }

  @Post('claim/:claimId/process')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.SUPERADMIN)
  async processClaimPayment(
    @Param('claimId') claimId: string,
    @Body() processPaymentDto: ProcessPaymentDto,
    @Request() req,
  ): Promise<PaymentResponseDto> {
    try {
      const result = await this.claimsService.processPayment(claimId, {
        bankCode: processPaymentDto.bankCode,
        accountNumber: processPaymentDto.accountNumber,
        accountName: processPaymentDto.accountName,
      });

      return plainToInstance(PaymentResponseDto, result);
    } catch (error) {
      throw new BadRequestException(error.message);
    }
  }

  @Get('claim/:claimId/status')
  async getClaimPaymentStatus(
    @Param('claimId') claimId: string,
  ): Promise<PaymentDetailsResponseDto> {
    try {
      const verification = await this.claimsService.verifyPayment(claimId);
      
      return plainToInstance(PaymentDetailsResponseDto, {
        claimId: verification.claimId,
        claimStatus: verification.claim?.status || 'UNKNOWN',
        amount: verification.claim?.amount || 0,
        payment: verification.payment,
        verification: verification.verification,
      });
    } catch (error) {
      throw new BadRequestException(error.message);
    }
  }

  @Get('claim/:claimId/transaction')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.SUPERADMIN)
  async getTransactionHistory(@Param('claimId') claimId: string) {
    try {
      const claim = await this.claimsService.findOne(claimId);
      if (!claim.payment?.transferReference) {
        throw new BadRequestException('No payment found for this claim');
      }
      
      const transaction = await this.paystackService.verifyTransfer(
        claim.payment.transferReference
      );

      return transaction;
    } catch (error) {
      throw new BadRequestException(error.message);
    }
  }
}