import { Module } from '@nestjs/common';
import { ClaimsService } from './claims.service';
import { ClaimsController } from './claims.controller';
import { UploadsModule } from '../uploads/uploads.module'; 
import { MailModule } from 'src/mail/mail.module';

@Module({
  imports: [UploadsModule, MailModule],
  providers: [ClaimsService],
  controllers: [ClaimsController]
})
export class ClaimsModule {}
