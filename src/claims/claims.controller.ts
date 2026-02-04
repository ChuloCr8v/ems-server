// src/claims/claims.controller.ts
import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
  Req,
  BadRequestException,
  HttpCode,
  HttpStatus,
  Request,
} from '@nestjs/common';
import { ClaimsService } from './claims.service';
import { CreateClaimDto, UpdateClaimDto } from './dto/claims.dto';
import { ClaimStatus, Role } from '@prisma/client';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from 'src/auth/guards/roles.guards';
import { AuthGuard } from 'src/auth/guards/auth.guard';
import { IAuthUser, ReqPayload } from 'src/auth/dto/auth.dto';
import { Auth, AuthUser } from 'src/auth/decorators/auth.decorator';
import { ProcessPaymentDto, VerifyBankAccountDto } from 'src/payment/payment.dto';
import { PaystackService } from 'src/payment/paystack.service'

@Controller('claims')
@UseGuards(AuthGuard, RolesGuard)
export class ClaimsController {
  constructor(
    private readonly claimsService: ClaimsService,
    private readonly paystackService: PaystackService
  ) { }

  @Post()
  async createClaim(@AuthUser() req: IAuthUser, @Body() data: CreateClaimDto) {
    return this.claimsService.addClaim(req.sub, data);
  }

  @Get()
  async findAll(
    @AuthUser() req: IAuthUser,
    @Query('status') status?: ClaimStatus,
  ) {
    const userId = req.sub;
    const userRole = req.role;
    return this.claimsService.findAll(userId, userRole, { status });
  }

  // Get single claim by ID
  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.claimsService.findOne(id);
  }

  @Patch('update/:id')
  async updateClaim(
    @Param('id') id: string,
    @AuthUser() req: IAuthUser,
    @Body() updateClaimDto: UpdateClaimDto,
  ) {
    const userRole = req.role;
    return this.claimsService.updateClaim(id, userRole, updateClaimDto);
  }

  // Delete claim
  @Auth()
  @Delete(':id')
  async remove(@Param('id') id: string, @AuthUser() req: IAuthUser) {
    const userId = req.sub;
    const userRole = req.role;
    return this.claimsService.removeClaim(id, userId, userRole);
  }

  // Update claim status (Managers/Admins only)
  @Auth([Role.ADMIN, Role.SUPERADMIN])
  @Patch(':id/approve')
  async approveClaim(
    @Param('id') id: string,
    @AuthUser() user: IAuthUser,
    @Body() body: { notes?: string },
  ) {
    return this.claimsService.updateStatus(
      id,
      'APPROVED',
      user.sub,
      body.notes,
    );
  }

  @Auth()
  @Patch(':id/reject')
  @Roles(Role.DEPT_MANAGER, Role.ADMIN)
  async rejectClaim(
    @Param('id') id: string,
    @AuthUser() user: IAuthUser,
    @Body() body: { notes?: string },
  ) {
    return this.claimsService.updateStatus(
      id,
      'REJECTED',
      user.sub,
      body.notes,
    );
  }

  //Comments

  @Auth()
  @Post(':id/comment')
  async commentOnTask(
    @Param('id') id: string,
    @Req() req: ReqPayload,
    @Body() dto: { comment: string; uploads?: string[] },
  ) {
    const userId = req.user.id;
    return this.claimsService.comment(id, userId, dto);
  }

  
    @Get('banks')
    @HttpCode(HttpStatus.OK)
    async getBanks() {
      try {
        // Get banks from Paystack
        const banks = await this.paystackService.getBanks();
        
        return {
          success: true,
          message: 'Banks retrieved successfully',
          data: banks,
        };
      } catch (error) {
        throw new BadRequestException({
          success: false,
          message: error.message || 'Failed to fetch banks',
          error: 'BANK_FETCH_FAILED',
        });
      }
    }
  
    @Post('verify-account')
    @HttpCode(HttpStatus.OK)
    async verifyAccount(
      @Body() verifyBankAccountDto: VerifyBankAccountDto,
    ) {
      try {
        const verificationResult = await this.paystackService.resolveBankAccount(
          verifyBankAccountDto.accountNumber,
          verifyBankAccountDto.bankCode,
        );
        
        if (verificationResult.status) {
          return {
            success: true,
            message: 'Account verified successfully',
            data: {
              accountNumber: verificationResult.data.account_number,
              accountName: verificationResult.data.account_name,
              bankCode: verifyBankAccountDto.bankCode,
              bankId: verificationResult.data.bank_id,
            },
          };
        }
        
        throw new Error(verificationResult.message || 'Account verification failed');
      } catch (error) {
        throw new BadRequestException({
          success: false,
          message: error.message || 'Account verification failed',
          error: 'ACCOUNT_VERIFICATION_FAILED',
        });
      }
    }
  
    @Post('claim/:claimId/process')
    @UseGuards(RolesGuard)
    @Roles(Role.ADMIN, Role.SUPERADMIN)
    @HttpCode(HttpStatus.OK)
    async processClaimPayment(
      @Param('claimId') claimId: string,
      @Body() processPaymentDto: ProcessPaymentDto,
      @Request() req,
    ) {
      try {
        // Use the ClaimsService to process payment
        const result = await this.claimsService.processPayment(claimId, {
          bankCode: processPaymentDto.bankCode,
          accountNumber: processPaymentDto.accountNumber,
          accountName: processPaymentDto.accountName,
        });
        
        return {
          success: true,
          message: 'Payment processed successfully',
          data: result,
        };
      } catch (error) {
        throw new BadRequestException({
          success: false,
          message: error.message || 'Payment processing failed',
          error: 'PAYMENT_PROCESSING_FAILED',
          claimId,
        });
      }
    }
  
    @Get('claim/:claimId/status')
    @HttpCode(HttpStatus.OK)
    async getClaimPaymentStatus(
      @Param('claimId') claimId: string,
    ) {
      try {
        const claim = await this.claimsService.findOne(claimId);
        
        if (!claim) {
          throw new BadRequestException('Claim not found');
        }
        
        // Get the latest payment from claimPayments array
        const latestPayment = claim.claimPayments?.length > 0 
          ? claim.claimPayments[claim.claimPayments.length - 1]
          : null;
        
        let transferStatus = null;
        let paystackData = null;
        
        // If payment exists and has transfer reference, verify with Paystack
        if (latestPayment?.transferReference) {
          try {
            paystackData = await this.paystackService.verifyTransfer(latestPayment.transferReference);
            transferStatus = paystackData.data?.status;
          } catch (error) {
            // Log but don't fail the request
            console.error('Paystack verification failed:', error);
          }
        }
        
        return {
          success: true,
          message: 'Payment status retrieved',
          data: {
            claimId: claim.id,
            claimStatus: claim.status,
            amount: claim.amount,
            payments: claim.claimPayments, // Return all payments
            latestPayment: latestPayment,
            paystackVerification: {
              transferReference: latestPayment?.transferReference,
              status: transferStatus,
              data: paystackData?.data,
            },
          },
        };
      } catch (error) {
        throw new BadRequestException({
          success: false,
          message: error.message || 'Failed to get payment status',
          error: 'PAYMENT_STATUS_FETCH_FAILED',
        });
      }
    }
  
    @Get('claim/:claimId/transaction')
    @UseGuards(RolesGuard)
    @Roles(Role.ADMIN, Role.SUPERADMIN)
    @HttpCode(HttpStatus.OK)
    async getTransactionHistory(
      @Param('claimId') claimId: string,
      @Query('reference') reference?: string,
    ) {
      try {
        const claim = await this.claimsService.findOne(claimId);
        
        if (!claim) {
          throw new BadRequestException('Claim not found');
        }
        
        // Get the latest payment
        const latestPayment = claim.claimPayments?.length > 0 
          ? claim.claimPayments[claim.claimPayments.length - 1]
          : null;
        
        const transferReference = reference || latestPayment?.transferReference;
        
        if (!transferReference) {
          throw new BadRequestException('No transfer reference available for this claim');
        }
        
        // Verify transfer with Paystack
        const verificationResult = await this.paystackService.verifyTransfer(transferReference);
        
        return {
          success: true,
          message: 'Transaction details retrieved',
          data: {
            claimId,
            transferReference,
            verification: verificationResult,
            claimPayments: claim.claimPayments,
            latestPayment: latestPayment,
          },
        };
      } catch (error) {
        throw new BadRequestException({
          success: false,
          message: error.message || 'Failed to get transaction history',
          error: 'TRANSACTION_FETCH_FAILED',
        });
      }
    }
  
    @Post('webhook/paystack')
    @HttpCode(HttpStatus.OK)
    async handlePaystackWebhook(
      @Body() webhookData: any,
      @Request() req,
    ) {
      try {
        const signature = req.headers['x-paystack-signature'];
        const secret = process.env.PAYSTACK_SECRET_KEY;
        
        // Verify webhook signature
        const isValid = this.validateWebhookSignature(signature, webhookData, secret);
        if (!isValid) {
          throw new Error('Invalid webhook signature');
        }
        
        const event = webhookData.event;
        const data = webhookData.data;
        
        switch (event) {
          case 'transfer.success':
            console.log('Transfer successful:', data.reference);
            await this.handleTransferEvent(data.reference, 'SUCCESS');
            break;
            
          case 'transfer.failed':
            console.log('Transfer failed:', data.reference);
            await this.handleTransferEvent(data.reference, 'FAILED', data.reason);
            break;
            
          case 'transfer.reversed':
            console.log('Transfer reversed:', data.reference);
            await this.handleTransferEvent(data.reference, 'REVERSED', data.reason);
            break;
            
          default:
            console.log(`Unhandled webhook event: ${event}`);
        }
        
        return { success: true, message: 'Webhook processed' };
      } catch (error) {
        console.error('Webhook processing failed:', error);
        // Return 200 to prevent Paystack from retrying too many times
        return { success: false, message: 'Webhook processing failed' };
      }
    }
  
    @Post('retry/:claimId')
    @UseGuards(RolesGuard)
    @Roles(Role.ADMIN, Role.SUPERADMIN)
    @HttpCode(HttpStatus.OK)
    async retryFailedPayment(
      @Param('claimId') claimId: string,
      @Body() retryData?: {
        bankCode?: string;
        accountNumber?: string;
        accountName?: string;
      },
      // @Request() req,
    ) {
      try {
        // Get the claim
        const claim = await this.claimsService.findOne(claimId);
        
        if (!claim) {
          throw new BadRequestException('Claim not found');
        }
        
        // Check if there's an existing failed payment
        const existingPayments = claim.claimPayments || [];
        const hasFailedPayment = existingPayments.some(p => p.status === 'FAILED');
        
        if (existingPayments.some(p => p.status === 'SUCCESS')) {
          throw new BadRequestException('Claim already has a successful payment');
        }
        
        // Prepare payment details
        const paymentDetails = {
          bankCode: retryData?.bankCode || claim.user?.bank?.bankCode,
          accountNumber: retryData?.accountNumber || claim.user?.bank?.accountNumber,
          accountName: retryData?.accountName || `${claim.user.firstName} ${claim.user.lastName}`,
        };
        
        if (!paymentDetails.bankCode || !paymentDetails.accountNumber) {
          throw new BadRequestException('Bank details are required for payment retry');
        }
        
        // Process the retry payment
        const result = await this.claimsService.processPayment(claimId, paymentDetails);
        
        return {
          success: true,
          message: hasFailedPayment ? 'Payment retry processed successfully' : 'Payment processed successfully',
          data: result,
        };
      } catch (error) {
        throw new BadRequestException({
          success: false,
          message: error.message || 'Payment retry failed',
          error: 'PAYMENT_RETRY_FAILED',
          claimId,
        });
      }
    }
  
    @Get('claim/:claimId/payments')
    @UseGuards(AuthGuard)
    @HttpCode(HttpStatus.OK)
    async getClaimPayments(
      @Param('claimId') claimId: string,
    ) {
      try {
        const claim = await this.claimsService.findOne(claimId);
        
        if (!claim) {
          throw new BadRequestException('Claim not found');
        }
        
        return {
          success: true,
          message: 'Claim payments retrieved successfully',
          data: {
            claimId,
            totalPayments: claim.claimPayments?.length || 0,
            payments: claim.claimPayments || [],
            latestPayment: claim.claimPayments?.length > 0 
              ? claim.claimPayments[claim.claimPayments.length - 1]
              : null,
          },
        };
      } catch (error) {
        throw new BadRequestException({
          success: false,
          message: error.message || 'Failed to get claim payments',
          error: 'PAYMENTS_FETCH_FAILED',
        });
      }
    }
  
    private async handleTransferEvent(
        transferReference: string,
        status: 'SUCCESS' | 'FAILED' | 'REVERSED',
        reason?: string,
      ) {
        try {
          // Find claim by transfer reference
          // You need to implement this method in ClaimsService
          if (typeof this.claimsService.findByTransferReference === 'function') {
            const claim = await this.claimsService.findByTransferReference(transferReference);
            
            if (claim && typeof this.claimsService.updatePaymentStatus === 'function') {
              await this.claimsService.updatePaymentStatus(
                claim.id,
                status,
                {
                  failureReason: status === 'FAILED' ? reason : undefined,
                  reversalReason: status === 'REVERSED' ? reason : undefined,
                  verifiedAt: new Date(),
                }
              );
              
              console.log(`Updated payment status for claim ${claim.id} to ${status}`);
            }
          }
        } catch (error) {
          console.error('Error handling transfer event:', error);
        }
      }
    
      private validateWebhookSignature(signature: string, body: any, secret: string): boolean {
        // Implement proper HMAC validation
        // For now, return true for development
        // In production, implement actual validation
        return true;
      }
}
