import { Module } from '@nestjs/common';
import { LeaveService } from './leave.service';
import { LeaveController } from './leave.controller';
import { PrismaModule } from 'src/prisma/prisma.module';
import { MailModule } from 'src/mail/mail.module';
import { ApproverModule } from 'src/approver/approver.module';
import { ApproverService } from 'src/approver/approver.service';

@Module({
  imports: [PrismaModule, MailModule, ],
  controllers: [LeaveController],
  providers: [LeaveService, ApproverService],
})
export class LeaveModule {}
