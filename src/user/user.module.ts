import { Module } from '@nestjs/common';
import { UserController } from './user.controller';
import { UserService } from './user.service';
import { PrismaModule } from 'src/prisma/prisma.module';
import { InviteModule } from 'src/invite/invite.module';
import { MailModule } from 'src/mail/mail.module';

@Module({
  imports: [PrismaModule, InviteModule, MailModule], 
  providers: [UserService],
  controllers: [UserController],
  exports: [UserService],
})
export class UserModule {}
