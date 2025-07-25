import { Module } from '@nestjs/common';
import { UserController } from './user.controller';
import { UserService } from './user.service';
import { PrismaModule } from 'src/prisma/prisma.module';
import { InviteService } from 'src/invite/invite.service';
import { InviteModule } from 'src/invite/invite.module';

@Module({
  imports: [PrismaModule, InviteModule], // ✅ Add this
  providers: [UserService],
  controllers: [UserController],
  exports: [UserService],
})
export class UserModule {}
