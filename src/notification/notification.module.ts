import { Module } from '@nestjs/common';
import { NotificationService } from './notification.service';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationListener } from 'src/listeners/notification.listener';
import { NotificationGateway } from './gateway/notification.gateway';

@Module({
    providers: [
        PrismaService,
        NotificationService,
        NotificationListener,
        NotificationGateway,
    ],
    exports: [NotificationService, NotificationGateway],
})
export class NotificationModule { }
