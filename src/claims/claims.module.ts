import { forwardRef, Module } from '@nestjs/common';
import { ClaimsService } from './claims.service';
import { ClaimsController } from './claims.controller';
import { UploadsModule } from '../uploads/uploads.module';
import { MailModule } from 'src/mail/mail.module';
import { PaymentModule } from 'src/payment/payment.module';
import { PaystackService } from 'src/payment/payment.service';

@Module({
  imports: [UploadsModule, MailModule,  forwardRef(() => PaymentModule)], // Use forwardRef to avoid circular dependency],
  providers: [ClaimsService, PaystackService],
  controllers: [ClaimsController]
})
export class ClaimsModule {}
