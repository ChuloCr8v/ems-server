import { Module } from '@nestjs/common';
import { OffboardingService } from './offboarding.service';
import { OffboardingController } from './offboarding.controller';
import { PrismaService } from 'src/prisma/prisma.service';
import { UserModule } from 'src/user/user.module';
import { AuthService } from 'src/auth/auth.service';
import { MailService } from 'src/mail/mail.service';


@Module({
  imports: [UserModule],
  controllers: [OffboardingController],
  providers: [
    OffboardingService, 
    PrismaService, 
    AuthService,
    MailService,
  ],
})
export class OffboardingModule {}
