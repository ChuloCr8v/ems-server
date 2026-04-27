import { Module } from '@nestjs/common';
import { OffboardingService } from './offboarding.service';
import { OffboardingController } from './offboarding.controller';
import { PrismaService } from 'src/prisma/prisma.service';
import { UserModule } from 'src/user/user.module';
import { AuthService } from 'src/auth/auth.service';
import { MailModule } from 'src/mail/mail.module';

@Module({
  imports: [UserModule, MailModule],
  controllers: [OffboardingController],
  providers: [OffboardingService, PrismaService, AuthService],
})
export class OffboardingModule {}
