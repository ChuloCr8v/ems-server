import { Module } from '@nestjs/common';
import { InviteService } from './invite.service';
import { InviteController } from './invite.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { MailModule } from 'src/mail/mail.module';
import { AuthService } from 'src/auth/auth.service';
import { UploadsModule } from 'src/uploads/uploads.module';

@Module({
  imports: [
    PrismaModule,
    MailModule,
    UploadsModule],
  providers: [InviteService, AuthService],
  controllers: [InviteController],
  exports: [InviteService,],
})
export class InviteModule { }
