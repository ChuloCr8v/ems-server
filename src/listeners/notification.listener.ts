import { OnEvent } from '@nestjs/event-emitter';
import { Injectable } from '@nestjs/common';
import { NotificationService } from '../notification/notification.service';
import { NotificationGateway } from 'src/notification/gateway/notification.gateway';
import { PrismaService } from 'src/prisma/prisma.service';
import { EmploymentAcceptedEvent, EmploymentApprovedEvent } from 'src/events/employment.event';

@Injectable()
export class NotificationListener {
    constructor(
        private notificationService: NotificationService,
        private gateway: NotificationGateway,
        private prisma: PrismaService,
    ) { }

    @OnEvent('employment.accepted')
    async handleEmploymentAccepted(event: EmploymentAcceptedEvent) {
        const prospect = await this.prisma.prospect.findUnique({
            where: { id: event.employeeId },
        });

        const notifications = event.recipientIds.map((recipientId) => ({
            recipientId,
            prospectId: event.employeeId,
            actorId: null,
            type: 'EMPLOYMENT_ACCEPTED',
            message: `${prospect.firstName} ${prospect.lastName} accepted their invitation.`,
        }));

        await this.notificationService.createMany(notifications);

        for (const recipientId of event.recipientIds) {
            this.gateway.sendToUser(recipientId, {
                type: 'EMPLOYMENT_ACCEPTED',
                message: `${prospect.firstName} ${prospect.lastName} accepted their invitation.`,
            });
        }
    }

    @OnEvent('employment.approved')
    async handleEmploymentApproved(event: EmploymentApprovedEvent) {
        const user = await this.prisma.user.findUnique({
            where: { id: event.employeeId },
        });

        const notifications = event.recipientIds.map((recipientId) => ({
            recipientId,
            actorId: event.employeeId,
            type: 'EMPLOYMENT_APPROVED',
            message: `New employee, ${user.firstName} ${user.lastName} was added. Assign properties from the employee page.`,
        }));

        await this.notificationService.createMany(notifications);

        for (const recipientId of event.recipientIds) {
            this.gateway.sendToUser(recipientId, {
                type: 'EMPLOYMENT_APPROVED',
                message: `New employee, ${user.firstName} ${user.lastName} was added. Assign properties from the employee page.`,
            });
        }
    }
}
