// src/payment/paystack.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { AxiosError } from 'axios';
import * as crypto from 'crypto';

export interface PaystackTransferRecipient {
  type: string;
  name: string;
  account_number: string;
  bank_code: string;
  currency?: string;
}

export interface PaystackTransferResponse {
  status: boolean;
  message: string;
  data: {
    recipient_code: string;
    [key: string]: any;
  };
}

export interface PaystackInitiateTransferResponse {
  status: boolean;
  message: string;
  data: {
    reference: string;
    [key: string]: any;
  };
}

export interface PaymentDetails {
  amount: number;
  recipientEmail: string;
  recipientName: string;
  recipientBankCode: string;
  recipientAccountNumber: string;
  narration: string;
  claimId: string;
}

// Helper function to safely extract error information
function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  return 'An unknown error occurred';
}

// Helper function to safely extract error stack
function getErrorStack(error: unknown): string | undefined {
  if (error instanceof Error) {
    return error.stack;
  }
  return undefined;
}

// Helper function to safely extract axios error response
function getAxiosErrorResponse(error: unknown): any {
  if (isAxiosError(error)) {
    return error.response?.data;
  }
  return null;
}

// Type guard for AxiosError
function isAxiosError(error: unknown): error is AxiosError {
  return (error as AxiosError).isAxiosError === true;
}

@Injectable()
export class PaystackService {
  private readonly baseUrl = 'https://api.paystack.co';
  private readonly secretKey: string;
  private readonly logger = new Logger(PaystackService.name);

  constructor(
    private configService: ConfigService,
    private readonly httpService: HttpService,
  ) {
    this.secretKey = this.configService.get<string>('PAYSTACK_SECRET_KEY');
    if (!this.secretKey) {
      throw new Error('PAYSTACK_SECRET_KEY is not configured');
    }
  }

  private getHeaders() {
    return {
      Authorization: `Bearer ${this.secretKey}`,
      'Content-Type': 'application/json',
    };
  }

  async getBanks(): Promise<any[]> {
    try {
      const response = await firstValueFrom(
        this.httpService.get(`${this.baseUrl}/bank`, {
          headers: this.getHeaders(),
          params: { country: 'nigeria', perPage: 100 },
        }),
      );
      return response.data.data;
    } catch (error: unknown) {
      this.handleError('Fetch Banks', error);
    }
  }

  async createTransferRecipient(data: PaystackTransferRecipient): Promise<PaystackTransferResponse> {
    try {
      const response = await firstValueFrom(
        this.httpService.post<PaystackTransferResponse>(
          `${this.baseUrl}/transferrecipient`,
          { ...data, currency: 'NGN' },
          { headers: this.getHeaders() },
        ),
      );
      return response.data;
    } catch (error: unknown) {
      this.handleError('Recipient Creation', error);
    }
  }

  // Refactored error handler to be cleaner
  private handleError(context: string, error: unknown): never {
    const errorData = getAxiosErrorResponse(error) || getErrorMessage(error);
    const errorMessage = getErrorMessage(error);
    
    this.logger.error(`Paystack Error [${context}]:`, errorData);
    throw new Error(`Paystack ${context} failed: ${errorMessage}`);
  }

  async initiateTransfer(
    recipientCode: string,
    amount: number,
    reason: string,
  ): Promise<PaystackInitiateTransferResponse> {
    try {
      const amountInKobo = Math.round(amount * 100);

      const response = await firstValueFrom(
        this.httpService.post<PaystackInitiateTransferResponse>(
          `${this.baseUrl}/transfer`,
          {
            source: 'balance',
            amount: amountInKobo,
            recipient: recipientCode,
            reason,
          },
          { headers: this.getHeaders() },
        ),
      );

      return response.data;
    } catch (error: unknown) {
      this.handleError('Initiate Transfer', error);
    }
  }

  async verifyTransfer(transferReference: string): Promise<any> {
    try {
      const response = await firstValueFrom(
        this.httpService.get(
          `${this.baseUrl}/transfer/${transferReference}`,
          { headers: this.getHeaders() },
        ),
      );

      return response.data;
    } catch (error: unknown) {
      this.handleError('Verify Transfer', error);
    }
  }

  async resolveBankAccount(accountNumber: string, bankCode: string): Promise<any> {
    try {
      const response = await firstValueFrom(
        this.httpService.get(
          `${this.baseUrl}/bank/resolve`,
          {
            headers: this.getHeaders(),
            params: {
              account_number: accountNumber,
              bank_code: bankCode,
            },
          },
        ),
      );

      return response.data;
    } catch (error: unknown) {
      this.handleError('Bank Account Resolution', error);
    }
  }

  // Type-safe version of resolveBankAccount
  async resolveBankAccountSafe(
    accountNumber: string, 
    bankCode: string
  ): Promise<{ 
    status: boolean; 
    message: string; 
    data?: { 
      account_name: string; 
      account_number: string; 
      bank_id: number;
    } 
  }> {
    try {
      const response = await firstValueFrom(
        this.httpService.get<{
          status: boolean;
          message: string;
          data?: { 
            account_name: string; 
            account_number: string; 
            bank_id: number;
          };
        }>(
          `${this.baseUrl}/bank/resolve`,
          {
            headers: this.getHeaders(),
            params: {
              account_number: accountNumber,
              bank_code: bankCode,
            },
          },
        ),
      );

      return response.data;
    } catch (error: unknown) {
      const errorMessage = getErrorMessage(error);
      return {
        status: false,
        message: `Bank account resolution failed: ${errorMessage}`,
      };
    }
  }

  async processPayment(paymentDetails: PaymentDetails): Promise<{
    success: boolean;
    transferReference: string | null;
    recipientCode: string | null;
    message: string;
  }> {
    try {
      this.logger.log(`Starting payment process for Claim: ${paymentDetails.claimId}`);

      // 1. Create (or get) transfer recipient
      const recipientResponse = await this.createTransferRecipient({
        type: 'nuban',
        name: paymentDetails.recipientName,
        account_number: paymentDetails.recipientAccountNumber,
        bank_code: paymentDetails.recipientBankCode,
      });

      if (!recipientResponse.status) {
        throw new Error(`Recipient creation failed: ${recipientResponse.message}`);
      }

      const recipientCode = recipientResponse.data.recipient_code;

      // 2. Initiate the actual transfer
      const transferResponse = await this.initiateTransfer(
        recipientCode,
        paymentDetails.amount,
        `${paymentDetails.narration} - Ref: ${paymentDetails.claimId}`,
      );

      if (!transferResponse.status) {
        throw new Error(`Transfer initiation failed: ${transferResponse.message}`);
      }

      return {
        success: true,
        transferReference: transferResponse.data.reference,
        recipientCode,
        message: 'Transfer queued successfully',
      };

    } catch (error: unknown) {
      const errorStack = getErrorStack(error);
      const errorMessage = getErrorMessage(error);
      
      this.logger.error(`Payment processing failed for claim ${paymentDetails.claimId}`, errorStack || errorMessage);
      
      return {
        success: false,
        transferReference: null,
        recipientCode: null,
        message: errorMessage || 'An internal error occurred during payment processing',
      };
    }
  }

  async getBalance(): Promise<{ balance: number; currency: string }> {
    try {
      const response = await firstValueFrom(
        this.httpService.get<{
          status: boolean;
          message: string;
          data: {
            balance: number;
            currency: string;
          };
        }>(
          `${this.baseUrl}/balance`,
          { headers: this.getHeaders() }
        ),
      );

      if (response.data.status && response.data.data) {
        return {
          balance: response.data.data.balance / 100, // Convert from kobo to naira
          currency: response.data.data.currency,
        };
      }
      throw new Error(response.data.message || 'Failed to fetch balance');
    } catch (error: unknown) {
      const errorMessage = getErrorMessage(error);
      throw new Error(`Failed to fetch balance: ${errorMessage}`);
    }
  }

  async listTransfers(params?: {
    page?: number;
    perPage?: number;
    status?: string;
  }): Promise<any[]> {
    try {
      const response = await firstValueFrom(
        this.httpService.get<{
          status: boolean;
          message: string;
          data: any[];
        }>(
          `${this.baseUrl}/transfer`,
          {
            headers: this.getHeaders(),
            params,
          },
        ),
      );

      if (response.data.status) {
        return response.data.data;
      }
      throw new Error(response.data.message || 'Failed to fetch transfers');
    } catch (error: unknown) {
      const errorMessage = getErrorMessage(error);
      throw new Error(`Failed to fetch transfers: ${errorMessage}`);
    }
  }

  validateWebhookSignature(signature: string, body: any): boolean {
    const secret = this.configService.get<string>('PAYSTACK_WEBHOOK_SECRET');
    
    if (!secret) {
      this.logger.warn('PAYSTACK_WEBHOOK_SECRET is not configured');
      return false;
    }
    
    try {
      const hash = crypto
        .createHmac('sha512', secret)
        .update(JSON.stringify(body))
        .digest('hex');
      
      return hash === signature;
    } catch (error: unknown) {
      const errorMessage = getErrorMessage(error);
      this.logger.error('Webhook signature validation failed:', errorMessage);
      return false;
    }
  }

  // Additional method: Disable a transfer recipient
  async disableTransferRecipient(recipientCode: string): Promise<boolean> {
    try {
      const response = await firstValueFrom(
        this.httpService.post(
          `${this.baseUrl}/transferrecipient/${recipientCode}`,
          { active: false },
          { headers: this.getHeaders() }
        ),
      );

      return response.data.status === true;
    } catch (error: unknown) {
      const errorMessage = getErrorMessage(error);
      this.logger.error(`Failed to disable transfer recipient ${recipientCode}:`, errorMessage);
      return false;
    }
  }

  // Additional method: Get transfer status
  async getTransferStatus(reference: string): Promise<{
    status: string;
    amount: number;
    recipient: string;
    createdAt: string;
    [key: string]: any;
  } | null> {
    try {
      const response = await firstValueFrom(
        this.httpService.get<{
          status: boolean;
          data: {
            status: string;
            amount: number;
            recipient: any;
            createdAt: string;
            [key: string]: any;
          };
        }>(
          `${this.baseUrl}/transfer/${reference}`,
          { headers: this.getHeaders() }
        ),
      );

      if (response.data.status && response.data.data) {
        return response.data.data;
      }
      return null;
    } catch (error: unknown) {
      const errorMessage = getErrorMessage(error);
      this.logger.error(`Failed to get transfer status for ${reference}:`, errorMessage);
      return null;
    }
  }
}