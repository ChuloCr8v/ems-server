import { Module } from '@nestjs/common';
import { CompetencyService } from './competency.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { MailModule } from 'src/mail/mail.module';
import { UserModule } from 'src/user/user.module';
import { CompetencyController } from './competency.controller';

@Module({
  imports: [MailModule, UserModule],
  controllers: [CompetencyController],
  providers: [CompetencyService, PrismaService],
})
export class CompetencyModule { }
