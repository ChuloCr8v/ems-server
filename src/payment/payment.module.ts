import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { PaystackService } from './paystack.service';
import * as https from 'https';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [
    ConfigModule,
    PrismaModule,
    HttpModule.register({
      timeout: 5000,
      maxRedirects: 5,
      // This is the fix: explicitly define the HTTPS Agent
      httpsAgent: new https.Agent({
        keepAlive: true,
        rejectUnauthorized: true 
      }),
      proxy: false, // Disables system-level proxies that cause SSL mismatches
    }),
  ],
  providers: [PaystackService],
  exports: [PaystackService],
})
export class PaymentModule {}