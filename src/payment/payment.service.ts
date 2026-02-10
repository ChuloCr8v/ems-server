// src/payment/paystack.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosError } from 'axios';
import * as crypto from 'crypto';

export interface PaystackTransferRecipient {
  type: string;
  name: string;
  account_number: string;
  bank_code: string;
  currency: string;
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

// Helper function to safely extract error messages
function getAxiosErrorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const axiosError = error as AxiosError;
    const responseData = axiosError.response?.data as any;
    return responseData?.message || axiosError.message || 'Axios error occurred';
  }
  
  if (error instanceof Error) {
    return error.message;
  }
  
  if (typeof error === 'string') {
    return error;
  }
  
  return 'An unknown error occurred';
}

// Helper function to safely extract response data
function getAxiosErrorResponse(error: unknown): any {
  if (axios.isAxiosError(error)) {
    const axiosError = error as AxiosError;
    return axiosError.response?.data || null;
  }
  return null;
}

@Injectable()
export class PaystackService {
  private readonly baseUrl = 'https://api.paystack.co';
  private readonly secretKey: string;
  private readonly logger = new Logger(PaystackService.name);

  constructor(private configService: ConfigService) {
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

  async createTransferRecipient(
    data: Omit<PaystackTransferRecipient, 'currency'>,
  ): Promise<PaystackTransferResponse> {
    try {
      const response = await axios.post(
        `${this.baseUrl}/transferrecipient`,
        {
          ...data,
          currency: 'NGN',
        },
        { headers: this.getHeaders() },
      );

      return response.data;
    } catch (error: unknown) {
      const errorResponse = getAxiosErrorResponse(error);
      const errorMessage = getAxiosErrorMessage(error);
      
      this.logger.error('Failed to create transfer recipient', errorResponse);
      throw new Error(`Paystack transfer recipient creation failed: ${errorMessage}`);
    }
  }

  async initiateTransfer(
    recipientCode: string,
    amount: number,
    reason: string,
  ): Promise<PaystackInitiateTransferResponse> {
    try {
      // Convert amount to kobo (Paystack uses kobo as the smallest currency unit)
      const amountInKobo = Math.round(amount * 100);

      const response = await axios.post(
        `${this.baseUrl}/transfer`,
        {
          source: 'balance',
          amount: amountInKobo,
          recipient: recipientCode,
          reason,
        },
        { headers: this.getHeaders() },
      );

      return response.data;
    } catch (error: unknown) {
      const errorResponse = getAxiosErrorResponse(error);
      const errorMessage = getAxiosErrorMessage(error);
      
      this.logger.error('Failed to initiate transfer', errorResponse);
      throw new Error(`Paystack transfer initiation failed: ${errorMessage}`);
    }
  }

  async verifyTransfer(transferReference: string): Promise<any> {
    try {
      const response = await axios.get(
        `${this.baseUrl}/transfer/${transferReference}`,
        { headers: this.getHeaders() },
      );

      return response.data;
    } catch (error: unknown) {
      const errorResponse = getAxiosErrorResponse(error);
      const errorMessage = getAxiosErrorMessage(error);
      
      this.logger.error('Failed to verify transfer', errorResponse);
      throw new Error(`Paystack transfer verification failed: ${errorMessage}`);
    }
  }

  async processPayment(paymentDetails: PaymentDetails): Promise<{
    success: boolean;
    transferReference: string | null;
    recipientCode: string | null;
    message: string;
  }> {
    try {
      // 1. Create transfer recipient
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

      // 2. Initiate transfer
      const transferResponse = await this.initiateTransfer(
        recipientCode,
        paymentDetails.amount,
        paymentDetails.narration,
      );

      if (!transferResponse.status) {
        throw new Error(`Transfer initiation failed: ${transferResponse.message}`);
      }

      return {
        success: true,
        transferReference: transferResponse.data.reference,
        recipientCode,
        message: 'Payment processed successfully',
      };
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      this.logger.error(`Payment processing failed for claim ${paymentDetails.claimId}`, errorMessage);
      return {
        success: false,
        transferReference: null,
        recipientCode: null,
        message: errorMessage,
      };
    }
  }

  async getBanks(): Promise<any[]> {
    try {
      const response = await axios.get(
        `${this.baseUrl}/bank`,
        { 
          headers: this.getHeaders(),
          params: {
            country: 'nigeria',
            perPage: 100,
          }
        }
      );

      if (response.data.status) {
        return response.data.data;
      }
      throw new Error('Failed to fetch banks from Paystack');
    } catch (error: unknown) {
      const errorResponse = getAxiosErrorResponse(error);
      const errorMessage = getAxiosErrorMessage(error);
      
      this.logger.error('Failed to fetch banks', errorResponse || errorMessage);
      throw new Error(`Failed to fetch banks: ${errorMessage}`);
    }
  }

  async resolveBankAccount(accountNumber: string, bankCode: string): Promise<any> {
    try {
      const response = await axios.get(
        `${this.baseUrl}/bank/resolve`,
        {
          headers: this.getHeaders(),
          params: {
            account_number: accountNumber,
            bank_code: bankCode,
          },
        }
      );

      return response.data;
    } catch (error: unknown) {
      const errorResponse = getAxiosErrorResponse(error);
      const errorMessage = getAxiosErrorMessage(error);
      
      this.logger.error('Failed to resolve bank account', errorResponse);
      throw new Error(`Bank account resolution failed: ${errorMessage}`);
    }
  }

  // Alternative method with more specific typing
  async resolveBankAccountSafe(
    accountNumber: string, 
    bankCode: string
  ): Promise<{ status: boolean; message: string; data?: { account_name: string; account_number: string } }> {
    try {
      const response = await axios.get<{
        status: boolean;
        message: string;
        data?: { account_name: string; account_number: string };
      }>(
        `${this.baseUrl}/bank/resolve`,
        {
          headers: this.getHeaders(),
          params: {
            account_number: accountNumber,
            bank_code: bankCode,
          },
        }
      );

      return response.data;
    } catch (error: unknown) {
      const errorResponse = getAxiosErrorResponse(error);
      const errorMessage = getAxiosErrorMessage(error);
      
      this.logger.error('Failed to resolve bank account', errorResponse);
      return {
        status: false,
        message: `Bank account resolution failed: ${errorMessage}`,
      };
    }
  }

  // Helper method for webhook signature validation
  validateWebhookSignature(signature: string, body: any, secret: string): boolean {
    try {
      const hash = crypto
        .createHmac('sha512', secret)
        .update(JSON.stringify(body))
        .digest('hex');
      
      return hash === signature;
    } catch (error: unknown) {
      this.logger.error('Webhook signature validation failed', error);
      return false;
    }
  }

  // Additional helper methods
  async getBalance(): Promise<{ balance: number; currency: string }> {
    try {
      const response = await axios.get(
        `${this.baseUrl}/balance`,
        { headers: this.getHeaders() }
      );

      if (response.data.status) {
        return {
          balance: response.data.data.balance / 100, // Convert from kobo to naira
          currency: response.data.data.currency,
        };
      }
      throw new Error('Failed to fetch balance from Paystack');
    } catch (error: unknown) {
      const errorMessage = getAxiosErrorMessage(error);
      throw new Error(`Failed to fetch balance: ${errorMessage}`);
    }
  }

  async listTransfers(params?: {
    page?: number;
    perPage?: number;
    status?: string;
  }): Promise<any[]> {
    try {
      const response = await axios.get(
        `${this.baseUrl}/transfer`,
        {
          headers: this.getHeaders(),
          params,
        }
      );

      if (response.data.status) {
        return response.data.data;
      }
      throw new Error('Failed to fetch transfers from Paystack');
    } catch (error: unknown) {
      const errorMessage = getAxiosErrorMessage(error);
      throw new Error(`Failed to fetch transfers: ${errorMessage}`);
    }
  }

  // Method to enable or disable transfer recipient
  async manageTransferRecipient(
    recipientCode: string,
    active: boolean
  ): Promise<boolean> {
    try {
      const response = await axios.post(
        `${this.baseUrl}/transferrecipient/${recipientCode}`,
        { active },
        { headers: this.getHeaders() }
      );

      return response.data.status;
    } catch (error: unknown) {
      const errorMessage = getAxiosErrorMessage(error);
      this.logger.error(`Failed to manage transfer recipient ${recipientCode}`, errorMessage);
      return false;
    }
  }
}