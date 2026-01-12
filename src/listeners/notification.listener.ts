import { OnEvent } from '@nestjs/event-emitter';
import { Injectable } from '@nestjs/common';
import { NotificationService } from '../notification/notification.service';
import { NotificationGateway } from 'src/notification/gateway/notification.gateway';
import { PrismaService } from 'src/prisma/prisma.service';
import { EmploymentAcceptedEvent, EmploymentApprovedEvent } from 'src/events/employment.event';
import { LeaveApprovedEvent, LeaveRequestedPayload } from 'src/events/leave.event';
import { TaskApprovedPayload, TaskAssignedPayload, TaskAssigneeChangePayload, TaskCreatePayload, TaskDueDateChangePayload, TaskPriorityChangePayload, TaskReassignedPayload, TaskRejectedPayload, TaskStatusChangePayload, TaskUpdatedPayload } from 'src/events/tasks.event';
import { MailService } from 'src/mail/mail.service';

@Injectable()
export class NotificationListener {
    constructor(
        private notificationService: NotificationService,
        private gateway: NotificationGateway,
        private prisma: PrismaService,
        private mailService: MailService,
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


    //Employee submits leave request
    @OnEvent('leave.requested')
    async handleLeaveRequest(event: LeaveRequestedPayload) {
        const employee = await this.prisma.user.findUnique({
            where: { id: event.employeeId },
        });

        const notifications = event.recipientIds.map((recipientId) => ({
            recipientId,
            actorId: event.employeeId,
            type: 'LEAVE_REQUESTED',
            message: `${employee.firstName} ${employee.lastName} has requested leave.`,
        }));
        await this.notificationService.createMany(notifications);

        for (const recipientId of event.recipientIds) {
            this.gateway.sendToUser(recipientId, {
                type: 'LEAVE_REQUESTED',
                message: `${employee.firstName} ${employee.lastName} has requested leave.`,
            })
        }
    }

    //Task is created and assigned to employee/s
    @OnEvent('task.created')
    async handleTaskCreated(event: TaskCreatePayload) {
        const employee = await this.prisma.user.findUnique({
            where: { id: event.employeeId },
        });

        const notifications = event.recipientIds.map((recipientId) => ({
            recipientId,
            actorId: event.employeeId,
            type: 'TASK_CREATED',
            message: `${employee.firstName} ${employee.lastName} has created a task.`,
        }));
        await this.notificationService.createMany(notifications);

        for (const recipientId of event.recipientIds) {
            this.gateway.sendToUser(recipientId, {
                type: 'TASK_CREATED',
                message: `${employee.firstName} ${employee.lastName} has created a task.`,
            });

            // Send email notification
            const recipient = await this.prisma.user.findUnique({ where: { id: recipientId } });
            if (recipient?.email) {
                await this.mailService.sendTaskCreatedMail({
                    email: recipient.email,
                    name: `${recipient.firstName} ${recipient.lastName}`,
                    taskId: event.taskId,
                    taskTitle: event.taskTitle,
                    taskDescription: event.taskDescription,
                    priority: event.priority,
                    dueDate: event.dueDate,
                    dashboardUrl: `${process.env.CLIENT_URL}/tasks/${event.taskId}`,
                });
            }
        }
    }

    //Task is assigned to employee/s
    @OnEvent('task.assigned')
    async handleTaskAssigned(event: TaskAssignedPayload) {
        const assigner = await this.prisma.user.findUnique({
            where: { id: event.employeeId },
        });

        const notifications = event.assigneeIds.map((assigneeId) => ({
            recipientId: assigneeId,
            actorId: event.employeeId,
            type: 'TASK_ASSIGNED',
            message: `${assigner.firstName} ${assigner.lastName} has assigned you a task.`,
        }));
        await this.notificationService.createMany(notifications);

        for (const assigneeId of event.assigneeIds) {
            this.gateway.sendToUser(assigneeId, {
                type: 'TASK_ASSIGNED',
                message: `${assigner.firstName} ${assigner.lastName} has assigned you a task.`,
            });

            // Send email notification
            const assignee = await this.prisma.user.findUnique({ where: { id: assigneeId } });
            if (assignee?.email) {
                await this.mailService.sendTaskAssignedMail({
                    email: assignee.email,
                    name: `${assignee.firstName} ${assignee.lastName}`,
                    assignedBy: `${assigner.firstName} ${assigner.lastName}`,
                    taskId: event.taskId,
                    taskTitle: event.taskTitle,
                    // taskDescription: event.taskDescription,
                    priority: event.priority,
                    dueDate: event.dueDate,
                    dashboardUrl: `${process.env.CLIENT_URL}/tasks/${event.taskId}`,
                });
            }
        }
    }

    //Task is updated
    @OnEvent('task.updated')
    async handleTaskUpdated(event: TaskUpdatedPayload) {
        const updater = await this.prisma.user.findUnique({
            where: { id: event.employeeId },
        });

        const notifications = event.recipientIds.map((recipientId) => ({
            recipientId,
            actorId: event.employeeId,
            type: 'TASK_UPDATED',
            message: `${updater.firstName} ${updater.lastName} has updated a task.`,
        }));
        await this.notificationService.createMany(notifications);

        for (const recipientId of event.recipientIds) {
            this.gateway.sendToUser(recipientId, {
                type: 'TASK_UPDATED',
                message: `${updater.firstName} ${updater.lastName} has updated a task.`,
            });

            // Send email notification
            const recipient = await this.prisma.user.findUnique({ where: { id: recipientId } });
            if (recipient?.email) {
                await this.mailService.sendTaskUpdatedMail({
                    email: recipient.email,
                    name: `${recipient.firstName} ${recipient.lastName}`,
                    updatedBy: `${updater.firstName} ${updater.lastName}`,
                    taskId: event.taskId,
                    taskTitle: event.taskTitle,
                    updateDetails: event.updateDetails,
                    dashboardUrl: `${process.env.CLIENT_URL}/tasks/${event.taskId}`,
                });
            }
        }
    }

    //Task status change handler
    @OnEvent('task.status.changed')
    async handleTaskStatusChanged(event: TaskStatusChangePayload) {
        const user = await this.prisma.user.findUnique({
            where: { id: event.employeeId },
        });

        //Different messages based on status
        const statusMessages = {
            'IN_PROGRESS': 'has started working on the task.',
            'COMPLETED': 'has completed the task.',
            'ISSUES': 'has reported an issue with the task.',
            'CANCELLED': 'has cancelled the task.',
        }
        const action = statusMessages[event.newStatus] || 'has changed status of';
        const message = `${user.firstName} ${user.lastName} ${action} task "${event.taskTitle}"`;

        //Notify creator and all assignees
        const allRecipients = [...new Set([event.creatorId, ...event.assigneeIds])];

        const notifications = allRecipients.map(recipientId => ({
            recipientId,
            actorId: event.employeeId,
            type: 'TASK_STATUS_CHANGED',
            message,
            metadata: {
                oldStatus: event.oldStatus,
                newStatus: event.newStatus,
                reason: event.reason,
                // taskId: event.taskId,
                // taskTitle: event.taskTitle,
            }
        }));
        await this.notificationService.createMany(notifications);

        ///Send real-time notifications
        for (const recipientId of allRecipients) {
            this.gateway.sendToUser(recipientId, {
                type: 'TASK_STATUS_CHANGED',
                message,
                taskId: event.taskId,
                oldStatus: event.oldStatus,
                newStatus: event.newStatus,
            });

            //Send email for important status 
            if (['COMPLETED', 'ISSUES', 'CANCELLED'].includes(event.newStatus)) {
                const recipient = await this.prisma.user.findUnique({
                    where: { id: recipientId }
                });
                if (recipient?.email) {
                    await this.mailService.sendTaskStatusChangeMail({
                        email: recipient.email,
                        name: `${recipient.firstName} ${recipient.lastName}`,
                        changedBy: `${user.firstName} ${user.lastName}`,
                        taskId: event.taskId,
                        taskTitle: event.taskTitle,
                        oldStatus: event.oldStatus,
                        newStatus: event.newStatus,
                        reason: event.reason,
                        dashboardUrl: `${process.env.CLIENT_URL}/tasks/${event.taskId}`,
                    });
                }
            }
        }
    }

    //Task assignee change handler
    @OnEvent('task.assignee.changed')
    async handleTaskAssigneeChanged(event: TaskAssigneeChangePayload) {
        const changer = await this.prisma.user.findUnique({
            where: { id: event.employeeId }
        });

        //Notify added assignees
        for (const assigneeId of event.addedAssigneeIds) {
            await this.notificationService.create({
                recipientId: assigneeId,
                actorId: event.employeeId,
                type: 'TASK_ASSIGNEE_TO_YOU',
                message: `${changer.firstName} ${changer.lastName} has assigned task "${event.taskTitle}" to you.`,
            });

            this.gateway.sendToUser(assigneeId, {
                type: 'TASK_ASSIGNEE_TO_YOU',
                message: `${changer.firstName} ${changer.lastName} has assigned task "${event.taskTitle}" to you.`,
            });
        }

        //Notify removed assignees
        for (const assigneeId of event.removedAssigneeIds) {
            await this.notificationService.create({
                recipientId: assigneeId,
                actorId: event.employeeId,
                type: 'TASK_UNASSIGNED',
                message: `You have been removed from task "${event.taskTitle}".`,
            });

            this.gateway.sendToUser(assigneeId, {
                type: 'TASK_UNASSIGNED',
                message: `You have been removed from task "${event.taskTitle}".`,
            });
        }

        //Notify creator
        await this.notificationService.create({
            recipientId: event.creatorId,
            actorId: event.employeeId,
            type: 'TASK_ASSIGNED',
            message: `${changer.firstName} ${changer.lastName} has assigned task "${event.taskTitle}" to you.`,
        });

        // this.gateway.sendToUser(event.creatorId,{
        //     type: 'TASK_ASSIGNED',
        //     message: `${changer.firstName} ${changer.lastName} has assigned task "${event.taskTitle}" to you.`,
        // });
    }

    @OnEvent('task.priority.changed')
    async handleTaskPriorityChanged(event: TaskPriorityChangePayload) {
        const changer = await this.prisma.user.findUnique({
            where: { id: event.employeeId },
        });

        const message = `${changer.firstName} ${changer.lastName} changed priority of task "${event.taskTitle}"
        from ${event.oldPriority} to ${event.newPriority}.`;

        const allRecipients = [...new Set([event.creatorId, ...event.assigneeIds])];

        const notifications = allRecipients.map(recipientId => ({
            recipientId,
            actorId: event.employeeId,
            type: 'TASK_PRIORITY_CHANGED',
            message
        }));

        await this.notificationService.createMany(notifications);

        for (const recipientId of allRecipients) {
            this.gateway.sendToUser(recipientId, {
                type: 'TASK_PRIORITY_CHANGED',
                message,
                taskId: event.taskId,
                oldPriority: event.oldPriority,
                newPriority: event.newPriority,
            });
        }
    }

    @OnEvent('task.duedate.changed')
    async handleTaskDueDateChanged(event: TaskDueDateChangePayload) {
        const changer = await this.prisma.user.findUnique({
            where: { id: event.employeeId },
        });

        const formatDate = (date?: Date) =>
            date ? new Date(date).toLocaleDateString() : 'Not set';

        const message =
            `${changer.firstName} ${changer.lastName} updated due date for task "${event.taskTitle}" from ${formatDate(event.oldDueDate)} to ${formatDate(event.newDueDate)}`;

        const allRecipients = [...new Set([event.creatorId, ...event.assigneeIds])];

        const notifications = allRecipients.map(recipientId => ({
            recipientId,
            actorId: event.employeeId,
            type: 'TASK_DUEDATE_CHANGED',
            message
        }));

        await this.notificationService.createMany(notifications);

        for (const recipientId of allRecipients) {
            this.gateway.sendToUser(recipientId, {
                type: 'TASK_DUEDATE_CHANGED',
                message,
                taskId: event.taskId,
                oldDueDate: event.oldDueDate,
                newDueDate: event.newDueDate,
            });

            // Send email notification for due date changes
            const recipient = await this.prisma.user.findUnique({ 
            where: { id: recipientId } 
            });

            //Send email notification for due date changes
            await this.mailService.sendTaskDueDateChangeMail({
                email: recipient.email,
                name: `${recipient.firstName} ${recipient.lastName}`,
                changedBy: `${changer.firstName} ${changer.lastName}`,
                taskId: event.taskId,
                taskTitle: event.taskTitle,
                oldDueDate: event.oldDueDate,
                newDueDate: event.newDueDate,
                dashboardUrl: `${process.env.CLIENT_URL}/tasks/${event.taskId}`,
            });
        }
    }

    //Task is approved
    // @OnEvent('task.approved')
    // async handleTaskApproved(event: TaskApprovedPayload) {
    //     const approver = await this.prisma.user.findUnique({
    //         where: { id: event.approverId },
    //     });

    //     // Notify creator
    //     await this.notificationService.createMany([{
    //         recipientId: event.creatorId,
    //         actorId: event.approverId,
    //         type: 'TASK_APPROVED',
    //         message: `${approver.firstName} ${approver.lastName} has approved your task.`,
    //     }]);

    //     this.gateway.sendToUser(event.creatorId, {
    //         type: 'TASK_APPROVED',
    //         message: `${approver.firstName} ${approver.lastName} has approved your task.`,
    //     });

    //     // Send email to creator
    //     const creator = await this.prisma.user.findUnique({ where: { id: event.creatorId } });
    //     if (creator?.email) {
    //         await this.mailService.sendTaskApprovedMail({
    //             email: creator.email,
    //             name: `${creator.firstName} ${creator.lastName}`,
    //             approvedBy: `${approver.firstName} ${approver.lastName}`,
    //             taskId: event.taskId,
    //             taskTitle: event.taskTitle,
    //             dashboardUrl: `${process.env.CLIENT_URL}/tasks/${event.taskId}`,
    //         });
    //     }

    //     // Notify assignees
    //     for (const assigneeId of event.assigneeIds) {
    //         await this.notificationService.createMany([{
    //             recipientId: assigneeId,
    //             actorId: event.approverId,
    //             type: 'TASK_APPROVED',
    //             message: `A task has been approved and assigned to you.`,
    //         }]);

    //         this.gateway.sendToUser(assigneeId, {
    //             type: 'TASK_APPROVED',
    //             message: `A task has been approved and assigned to you.`,
    //         });

    //         // Send email to assignees
    //         const assignee = await this.prisma.user.findUnique({ where: { id: assigneeId } });
    //         if (assignee?.email) {
    //             await this.mailService.sendTaskApprovedMail({
    //                 email: assignee.email,
    //                 name: `${assignee.firstName} ${assignee.lastName}`,
    //                 approvedBy: `${approver.firstName} ${approver.lastName}`,
    //                 taskId: event.taskId,
    //                 taskTitle: event.taskTitle,
    //                 dashboardUrl: `${process.env.CLIENT_URL}/tasks/${event.taskId}`,
    //             });
    //         }
    //     }
    // }

    //Task is rejected
    // @OnEvent('task.rejected')
    // async handleTaskRejected(event: TaskRejectedPayload) {
    //     const rejector = await this.prisma.user.findUnique({
    //         where: { id: event.rejectorId },
    //     });

    //     await this.notificationService.createMany([{
    //         recipientId: event.creatorId,
    //         actorId: event.rejectorId,
    //         type: 'TASK_REJECTED',
    //         message: `${rejector.firstName} ${rejector.lastName} has rejected your task.`,
    //     }]);

    //     this.gateway.sendToUser(event.creatorId, {
    //         type: 'TASK_REJECTED',
    //         message: `${rejector.firstName} ${rejector.lastName} has rejected your task.`,
    //     });

    //     // Send email notification
    //     const creator = await this.prisma.user.findUnique({ where: { id: event.creatorId } });
    //     if (creator?.email) {
    //         await this.mailService.sendTaskRejectedMail({
    //             email: creator.email,
    //             name: `${creator.firstName} ${creator.lastName}`,
    //             rejectedBy: `${rejector.firstName} ${rejector.lastName}`,
    //             taskId: event.taskId,
    //             taskTitle: event.taskTitle,
    //             rejectionReason: event.rejectionReason,
    //             dashboardUrl: `${process.env.CLIENT_URL}/tasks/${event.taskId}`,
    //         });
    //     }
    // }

    //Task is reassigned/transferred
    @OnEvent('task.reassigned')
    async handleTaskReassigned(event: TaskReassignedPayload) {
        const transferrer = await this.prisma.user.findUnique({
            where: { id: event.transferredById },
        });

        // Notify new owner
        await this.notificationService.createMany([{
            recipientId: event.newOwnerId,
            actorId: event.transferredById,
            type: 'TASK_REASSIGNED',
            message: `${transferrer.firstName} ${transferrer.lastName} has reassigned a task to you.`,
        }]);

        this.gateway.sendToUser(event.newOwnerId, {
            type: 'TASK_REASSIGNED',
            message: `${transferrer.firstName} ${transferrer.lastName} has reassigned a task to you.`,
        });

        // Send email to new owner
        const newOwner = await this.prisma.user.findUnique({ where: { id: event.newOwnerId } });
        if (newOwner?.email) {
            await this.mailService.sendTaskReassignedMail({
                email: newOwner.email,
                name: `${newOwner.firstName} ${newOwner.lastName}`,
                reassignedBy: `${transferrer.firstName} ${transferrer.lastName}`,
                taskId: event.taskId,
                taskTitle: event.taskTitle,
                note: event.note,
                newDueDate: event.newDueDate,
                dashboardUrl: `${process.env.CLIENT_URL}/tasks/${event.taskId}`,
            });
        }

        // Notify previous owner
        if (event.previousOwnerId !== event.newOwnerId) {
            await this.notificationService.createMany([{
                recipientId: event.previousOwnerId,
                actorId: event.transferredById,
                type: 'TASK_REASSIGNED',
                message: `A task has been reassigned from you.`,
            }]);

            this.gateway.sendToUser(event.previousOwnerId, {
                type: 'TASK_REASSIGNED',
                message: `A task has been reassigned from you.`,
            });
        }
    }

    //Manager or HR approves leave
    @OnEvent('leave_approved')
    async handleApprovedLeave(event: LeaveApprovedEvent) {
        const approver = await this.prisma.user.findUnique({
            where: { id: event.approverId },
            // include: { requests: { include: { user: true, } } },
        });
        const employee = await this.prisma.user.findUnique({
            where: { id: event.employeeId },
        });

        const recipientIds = Array.isArray(event.employeeId) ? event.employeeId : [event.employeeId];
        const notifications = recipientIds.map((recipientId) => ({
            recipientId,
            actorId: event.approverId,
            type: 'LEAVE_APPROVED',
            message: `${employee.firstName} ${employee.lastName}'s leave has been approved by ${approver.firstName} ${approver.lastName}.`
        }));
        await this.notificationService.createMany(notifications);

        for (const recipientId of recipientIds) {
            this.gateway.sendToUser(recipientId, {
                type: 'LEAVE_APPROVED',
                message: `${employee.firstName} ${employee.lastName}'s leave has been approved by ${approver.firstName} ${approver.lastName}.`,
            });
        }
    }
}
