import { Module } from '@nestjs/common';
import { EntitlementService } from './entitlement.service';
import { EntitlementController } from './entitlement.controller';
import { PrismaModule } from 'src/prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [EntitlementController],
  providers: [EntitlementService],
})
export class EntitlementModule {}
