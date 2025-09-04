import { Module } from '@nestjs/common';
import { ApproverService } from './approver.service';
import { ApproverController } from './approver.controller';
import { PrismaModule } from 'src/prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [ApproverController],
  providers: [ApproverService],
})
export class ApproverModule {}
