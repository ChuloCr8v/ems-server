import { Module } from '@nestjs/common';
import { UserController } from './user.controller';
import { UserService } from './user.service';
import { PrismaModule } from 'src/prisma/prisma.module';

@Module({
  imports: [PrismaModule], // ✅ Add this
  providers: [UserService],
  controllers: [UserController],
  exports: [UserService],
})
export class UserModule {}
