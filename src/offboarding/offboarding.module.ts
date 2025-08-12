import { Module } from '@nestjs/common';
import { OffboardingService } from './offboarding.service';
import { OffboardingController } from './offboarding.controller';
import { PrismaService } from 'src/prisma/prisma.service';
import { UserModule } from 'src/user/user.module';


@Module({
  imports: [UserModule],
  controllers: [OffboardingController],
  providers: [OffboardingService, PrismaService],
})
export class OffboardingModule {}
