// src/payment/paystack.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

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
    } catch (error) {
      this.logger.error('Failed to create transfer recipient', error.response?.data);
      throw new Error(`Paystack transfer recipient creation failed: ${error.message}`);
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
    } catch (error) {
      this.logger.error('Failed to initiate transfer', error.response?.data);
      throw new Error(`Paystack transfer initiation failed: ${error.message}`);
    }
  }

  async verifyTransfer(transferReference: string) {
    try {
      const response = await axios.get(
        `${this.baseUrl}/transfer/${transferReference}`,
        { headers: this.getHeaders() },
      );

      return response.data;
    } catch (error) {
      this.logger.error('Failed to verify transfer', error.response?.data);
      throw new Error(`Paystack transfer verification failed: ${error.message}`);
    }
  }

  async processPayment(paymentDetails: PaymentDetails): Promise<{
    success: boolean;
    transferReference: string;
    recipientCode: string;
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
    } catch (error) {
      this.logger.error(`Payment processing failed for claim ${paymentDetails.claimId}`, error);
      return {
        success: false,
        transferReference: null,
        recipientCode: null,
        message: error.message,
      };
    }
  }
}