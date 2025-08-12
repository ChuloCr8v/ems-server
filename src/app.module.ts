import { Module } from '@nestjs/common';

import { UserModule } from './user/user.module';
import { InviteModule } from './invite/invite.module';
import { AuthModule } from './auth/auth.module';
import { PrismaModule } from './prisma/prisma.module';
import { ConfigModule } from '@nestjs/config';
import { DepartmentModule } from './department/department.module';
import { LevelModule } from './level/level.module';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AssetModule } from './assets/asset.module';
import { OffboardingModule } from './offboarding/offboarding.module';

@Module({
  imports: [
    UserModule,
    InviteModule,
    AuthModule,
    PrismaModule,
    ConfigModule.forRoot({ isGlobal: true }),
    DepartmentModule,
    LevelModule,
    AssetModule,
    OffboardingModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule { }
