// src/payment/payment.module.ts
import { forwardRef, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PaymentController } from './payment.controller';
import { ClaimsModule } from '../claims/claims.module';
import { PrismaModule } from '../prisma/prisma.module';
import { PaystackService } from './payment.service';

@Module({
  imports: [
    forwardRef(() => ClaimsModule),
    ConfigModule,
    PrismaModule, // If you have a PrismaModule, otherwise remove this
  ],
  controllers: [PaymentController],
  providers: [PaystackService],
  exports: [PaystackService], // Export so other modules can use it
})
export class PaymentModule {}