import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios'; // Import this
import { firstValueFrom } from 'rxjs'; // For Promise conversion
import * as crypto from 'crypto';

@Injectable()
export class PaystackService {
  private readonly baseUrl = 'https://api.paystack.co';
  private readonly secretKey: string;
  private readonly logger = new Logger(PaystackService.name);

  constructor(
    private configService: ConfigService,
    private readonly httpService: HttpService, // Inject HttpService
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
    } catch (error) {
      this.handleError('Fetch Banks', error);
    }
  }

  async createTransferRecipient(data: any): Promise<any> {
    try {
      const response = await firstValueFrom(
        this.httpService.post(
          `${this.baseUrl}/transferrecipient`,
          { ...data, currency: 'NGN' },
          { headers: this.getHeaders() },
        ),
      );
      return response.data;
    } catch (error) {
      this.handleError('Recipient Creation', error);
    }
  }

  // Refactored error handler to be cleaner
  private handleError(context: string, error: any) {
    const errorData = error.response?.data || error.message;
    this.logger.error(`Paystack Error [${context}]:`, errorData);
    throw new Error(`Paystack ${context} failed: ${error.message}`);
  }

  // Use this logic for resolveBankAccount and initiateTransfer as well...
  async initiateTransfer(
    recipientCode: string,
    amount: number,
    reason: string,
  ): Promise<PaystackInitiateTransferResponse> {
    try {
      const amountInKobo = Math.round(amount * 100);

      const response = await firstValueFrom(
        this.httpService.post(
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
    } catch (error) {
      this.handleError('Initiate Transfer', error);
    }
  }

  async verifyTransfer(transferReference: string) {
    try {
      const response = await firstValueFrom(
        this.httpService.get(
          `${this.baseUrl}/transfer/${transferReference}`,
          { headers: this.getHeaders() },
        ),
      );

      return response.data;
    } catch (error) {
      this.handleError('Verify Transfer', error);
    }
  }

  async resolveBankAccount(accountNumber: string, bankCode: string) {
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
    } catch (error) {
      this.handleError('Bank Account Resolution', error);
    }
  }

  async processPayment(paymentDetails: PaymentDetails): Promise<{
  success: boolean;
  transferReference: string;
  recipientCode: string;
  message: string;
}> {
  try {
    this.logger.log(`Starting payment process for Claim: ${paymentDetails.claimId}`);

    // 1. Create (or get) transfer recipient
    // Paystack will return the existing recipient_code if the account is already registered
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
    // We pass the claimId as the reason or in metadata (optional) to track it
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

  } catch (error) {
    this.logger.error(`Payment processing failed for claim ${paymentDetails.claimId}`, error.stack);
    
    return {
      success: false,
      transferReference: null,
      recipientCode: null,
      message: error.message || 'An internal error occurred during payment processing',
    };
  }
}

// ... inside the class
// validateWebhookSignature(signature: string, body: any): boolean {
//   const secret = this.configService.get<string>('PAYSTACK_WEBHOOK_SECRET');
  
//   const hash = crypto
//     .createHmac('sha512', secret)
//     .update(JSON.stringify(body))
//     .digest('hex');
  
//   return hash === signature;
// }



}

export interface PaystackInitiateTransferResponse {
    status: boolean;
    message: string;
    data: {
        reference: string;
        [key: string]: any;
    }
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