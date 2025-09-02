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
import { UploadsController } from './uploads/uploads.controller';
import { UploadsService } from './uploads/uploads.service';
import { UploadsModule } from './uploads/uploads.module';
import { NotificationService } from './notification/notification.service';
import { NotificationController } from './notification/notification.controller';
import { NotificationModule } from './notification/notification.module';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ClaimsModule } from './claims/claims.module';

@Module({
  imports: [
    EventEmitterModule.forRoot(),
    UserModule,
    InviteModule,
    AuthModule,
    PrismaModule,
    ConfigModule.forRoot({ isGlobal: true }),
    DepartmentModule,
    LevelModule,
    AssetModule,
    OffboardingModule,
    UploadsModule,
    NotificationModule,
    ClaimsModule
  ],
  controllers: [AppController, UploadsController, NotificationController],
  providers: [AppService, UploadsService, NotificationService],
})
export class AppModule { }
