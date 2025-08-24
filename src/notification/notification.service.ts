import { Injectable } from "@nestjs/common";
import { PrismaService } from "src/prisma/prisma.service";

// notification.service.ts
@Injectable()
export class NotificationService {
    constructor(private prisma: PrismaService) { }

    async createMany(notifications: {
        recipientId: string;
        actorId: string;
        type: string;
        message: string;
    }[]) {
        return this.prisma.notification.createMany({ data: notifications });
    }

    async getForUser(userId: string) {
        return this.prisma.notification.findMany({
            where: { recipientId: userId },
            orderBy: { createdAt: 'desc' },
            include: { actor: true },
        });
    }

    async markAsRead(notificationId: string) {
        return this.prisma.notification.update({
            where: { id: notificationId },
            data: { read: true },
        });
    }

    async markAllAsRead(userId: string) {
        return this.prisma.notification.updateMany({
            where: { recipientId: userId, read: false },
            data: { read: true },
        });
    }
}
