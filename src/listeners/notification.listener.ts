import { OnEvent } from '@nestjs/event-emitter';
import { Injectable } from '@nestjs/common';
import { NotificationService } from '../notification/notification.service';
import { NotificationGateway } from 'src/notification/gateway/notification.gateway';
import { PrismaService } from 'src/prisma/prisma.service';
import { EmploymentAcceptedEvent, EmploymentApprovedEvent } from 'src/events/employment.event';
import { LeaveApprovedEvent, LeaveRequestedPayload } from 'src/events/leave.event';
import { NotificationActionType } from '@prisma/client';
import { TaskAssignedEvent, TaskCreatedEvent, TaskUpdatedEvent, TaskStatusChangeEvent } from 'src/events/tasks.event';
// import { ClaimApprovedEvent, ClaimCreatedEvent, ClaimRejectedEvent } from 'src/events/claim.event';
import { ClaimApprovedEvent, ClaimCreatedEvent, ClaimRejectedEvent } from 'src/events/claim.event';
import { PayslipGeneratedEvent } from 'src/events/payroll.event';
// import { TaskApprovedPayload, TaskAssignedPayload, TaskAssigneeChangePayload, TaskCreatePayload, TaskDueDateChangePayload, TaskPriorityChangePayload, TaskReassignedPayload, TaskRejectedPayload, TaskStatusChangePayload, TaskUpdatedPayload } from 'src/events/tasks.event';
// import { MailService } from 'src/mail/mail.service';
import { MailService } from 'src/mail/mail.service';
import { TaskAssignedDto } from 'src/mail/mail.types';
import { AppraisalCreatedEvent, AppraisalSubmittedEvent, AppraisalReviewedEvent } from 'src/events/appraisal.event';
import { AppraisalMailDto } from 'src/mail/mail.types';

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
            title: 'Employment Invitation Accepted',
            message: `Great news! ${prospect.firstName} ${prospect.lastName} has accepted the employment invitation. You can now proceed with the onboarding process.`,
        }));

        await this.notificationService.createMany(notifications);

        for (const recipientId of event.recipientIds) {
            this.gateway.sendToUser(recipientId, {
                type: 'EMPLOYMENT_ACCEPTED',
                title: 'Employment Invitation Accepted',
                message: `Great news! ${prospect.firstName} ${prospect.lastName} has accepted the employment invitation. You can now proceed with the onboarding process.`,
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
            title: 'New Employee Added',
            message: `${user.firstName} ${user.lastName} has been officially added to the system. Please visit the employee page to assign necessary properties and complete the setup.`,
        }));

        await this.notificationService.createMany(notifications);

        for (const recipientId of event.recipientIds) {
            this.gateway.sendToUser(recipientId, {
                type: 'EMPLOYMENT_APPROVED',
                title: 'New Employee Added',
                message: `${user.firstName} ${user.lastName} has been officially added to the system. Please visit the employee page to assign necessary properties and complete the setup.`,
            });
        }
    }

    //Employee submits leave request
    @OnEvent('leaveRequest.created')
    async handleLeaveRequest(event: LeaveRequestedPayload) {
        const employee = await this.prisma.user.findUnique({
            where: { id: event.employeeId },
        });

        const notifications = event.recipientIds.map((recipientId) => ({
            recipientId,
            actorId: event.employeeId,
            type: 'LEAVE_REQUESTED',
            title: 'New Leave Request',
            message: `${employee.firstName} ${employee.lastName} has submitted a new leave request awaiting your review and approval.`,
            actionType: NotificationActionType.LEAVE_REQUESTED,
            actionData: {
                requestId: event.leaveRequestId
            }
        }));
        await this.notificationService.createMany(notifications);

        for (const recipientId of event.recipientIds) {
            this.gateway.sendToUser(recipientId, {
                type: 'LEAVE_REQUESTED',
                title: 'New Leave Request',
                message: `${employee.firstName} ${employee.lastName} has submitted a new leave request awaiting your review and approval.`,
            })
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
            title: 'Leave Request Approved',
            message: `Your leave request has been successfully approved. Enjoy your time off!`,
            actionType: NotificationActionType.LEAVE_APPROVED,
            actionData: {
                requestId: event.leaveRequestId
            }
        }));
        await this.notificationService.createMany(notifications);

        for (const recipientId of recipientIds) {
            this.gateway.sendToUser(recipientId, {
                type: 'LEAVE_APPROVED',
                title: 'Leave Request Approved',
                message: `Your leave request has been successfully approved. Enjoy your time off!`,
            });
        }
    }

    @OnEvent('leave.declined')
    async handleDeclinedLeave(event: LeaveApprovedEvent) {

        const recipientIds = Array.isArray(event.employeeId) ? event.employeeId : [event.employeeId];
        const notifications = recipientIds.map((recipientId) => ({
            recipientId,
            actorId: event.approverId,
            type: 'LEAVE_DECLINED',
            title: 'Leave Request Declined',
            message: `We regret to inform you that your leave request has been declined. Please contact your manager for more details.`,
            actionType: NotificationActionType.LEAVE_DECLINED,
            actionData: {
                requestId: event.leaveRequestId
            }
        }));

        await this.notificationService.createMany(notifications);

        for (const recipientId of recipientIds) {
            this.gateway.sendToUser(recipientId, {
                type: 'LEAVE_DECLINED',
                title: 'Leave Request Declined',
                message: `We regret to inform you that your leave request has been declined. Please contact your manager for more details.`,
            });
        }
    }

    // Claim Events
    @OnEvent('claim.created')
    async handleClaimCreated(event: ClaimCreatedEvent) {
        const employee = await this.prisma.user.findUnique({
            where: { id: event.employeeId },
        });

        const notifications = event.recipientIds.map((recipientId) => ({
            recipientId,
            actorId: event.employeeId,
            type: 'CLAIM_CREATED',
            title: 'New Claim Submitted',
            message: `${employee.firstName} ${employee.lastName} has submitted a new expense claim. Please review the details for approval.`,
            actionType: NotificationActionType.CLAIM_CREATED,
            actionData: {
                claimId: event.claimId
            }
        }));

        await this.notificationService.createMany(notifications);

        for (const recipientId of event.recipientIds) {
            this.gateway.sendToUser(recipientId, {
                type: 'CLAIM_CREATED',
                title: 'New Claim Submitted',
                message: `${employee.firstName} ${employee.lastName} has submitted a new expense claim. Please review the details for approval.`,
            });
        }
    }

    @OnEvent('claim.approved')
    async handleClaimApproved(event: ClaimApprovedEvent) {
        const recipientIds = Array.isArray(event.recipientIds) ? event.recipientIds : [event.recipientIds]; // Should just be one, the employee

        const notifications = recipientIds.map((recipientId) => ({
            recipientId,
            actorId: event.approverId,
            type: 'CLAIM_APPROVED',
            title: 'Claim Approved',
            message: `Your expense claim request has been approved and is being processed for payment.`,
            actionType: NotificationActionType.CLAIM_APPROVED,
            actionData: {
                claimId: event.claimId
            }
        }));

        await this.notificationService.createMany(notifications);

        for (const recipientId of recipientIds) {
            this.gateway.sendToUser(recipientId, {
                type: 'CLAIM_APPROVED',
                title: 'Claim Approved',
                message: `Your expense claim request has been approved and is being processed for payment.`,
            });
        }
    }

    @OnEvent('claim.rejected')
    async handleClaimRejected(event: ClaimRejectedEvent) {
        const recipientIds = Array.isArray(event.recipientIds) ? event.recipientIds : [event.recipientIds];

        const notifications = recipientIds.map((recipientId) => ({
            recipientId,
            actorId: event.approverId,
            type: 'CLAIM_REJECTED',
            title: 'Claim Rejected',
            message: `Your expense claim request has been rejected. Please check the comments or contact finance for clarification.`,
            actionType: NotificationActionType.CLAIM_REJECTED,
            actionData: {
                claimId: event.claimId
            }
        }));

        await this.notificationService.createMany(notifications);

        for (const recipientId of recipientIds) {
            this.gateway.sendToUser(recipientId, {
                type: 'CLAIM_REJECTED',
                title: 'Claim Rejected',
                message: `Your expense claim request has been rejected. Please check the comments or contact finance for clarification.`,
            });
        }
    }

    @OnEvent('task.assigned')
    async handleTaskAssignment(event: TaskAssignedEvent) {

        // Fetch assigner details
        const assigner = await this.prisma.user.findUnique({
            where: { id: event.employeeId },
        });

        // Fetch assignees details
        const assignees = await this.prisma.user.findMany({
            where: { id: { in: event.assigneeIds } },
        });

        const notifications = assignees.map((assignee) => ({
            recipientId: assignee.id,
            actorId: event.employeeId,
            type: 'TASK_ASSIGNED',
            title: 'New Task Assignment',
            message: `You have been assigned a new task: "${event.taskTitle}". Please check your task board for details and deadlines.`,
            actionType: NotificationActionType.TASK_ASSIGNED,
            actionData: {
                taskId: event.taskId
            }
        }));

        await this.notificationService.createMany(notifications);

        for (const assignee of assignees) {
            // Socket Notification
            this.gateway.sendToUser(assignee.id, {
                type: 'TASK_ASSIGNED',
                title: 'New Task Assignment',
                message: `You have been assigned a new task: "${event.taskTitle}". Please check your task board for details and deadlines.`,
            });

            // Email Notification
            const mailData: TaskAssignedDto = {
                email: assignee.email,
                name: assignee.firstName,
                assignedBy: assigner ? `${assigner.firstName} ${assigner.lastName}` : 'System',
                taskId: event.taskId,
                taskTitle: event.taskTitle,
                priority: event.priority,
                dueDate: event.dueDate,
                dashboardUrl: process.env.CLIENT_URL || 'http://localhost:5173',
            };

            await this.mailService.sendTaskAssignedMail(mailData);
        }
    }

    private formatEnumString(status: string): string {
        return status
            .toLowerCase()
            .split('_')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' ');
    }

    @OnEvent('task.updated')
    async handleTaskUpdated(event: TaskUpdatedEvent) {
        const recipientIds = Array.isArray(event.recipientIds) ? event.recipientIds : [event.recipientIds];

        const notifications = recipientIds.map((recipientId) => ({
            recipientId,
            actorId: event.employeeId,
            type: 'TASK_UPDATED',
            title: 'Task Update',
            message: `Task "${event.taskTitle}" updated: ${event.updateDetails}.`,
            actionType: NotificationActionType.TASK_UPDATED,
            actionData: {
                taskId: event.taskId
            }
        }));

        await this.notificationService.createMany(notifications);

        for (const recipientId of recipientIds) {
            this.gateway.sendToUser(recipientId, {
                type: 'TASK_UPDATED',
                title: 'Task Update',
                message: `Task "${event.taskTitle}" updated: ${event.updateDetails}.`,
            });
        }
    }

    @OnEvent('task.created')
    async handleTaskCreated(event: TaskCreatedEvent) {
        const recipientIds = Array.isArray(event.recipientIds) ? event.recipientIds : [event.recipientIds];

        const notifications = recipientIds.map((recipientId) => ({
            recipientId,
            actorId: event.employeeId,
            type: 'TASK_CREATED',
            title: 'Task Approval Required',
            message: `A new task "${event.taskTitle}" has been created and requires your approval before it can be assigned.`,
            actionType: NotificationActionType.TASK_CREATED,
            actionData: {
                taskId: event.taskId
            }
        }));

        await this.notificationService.createMany(notifications);

        for (const recipientId of recipientIds) {
            this.gateway.sendToUser(recipientId, {
                type: 'TASK_CREATED',
                title: 'Task Approval Required',
                message: `A new task "${event.taskTitle}" has been created and requires your approval before it can be assigned.`,
            });
        }
    }

    @OnEvent('payroll.generated')
    async handlePayslipGenerated(event: PayslipGeneratedEvent) {
        const notification = {
            recipientId: event.userId,
            actorId: null, // System notification
            type: 'PAYSLIP_GENERATED',
            title: 'Payslip Available',
            message: `Your payslip for ${event.month} ${event.year} has been generated and is now available for download.`,
            actionType: NotificationActionType.PAYSLIP_GENERATED,
            actionData: {
                payrollId: event.payrollId,
                month: event.month,
                year: event.year
            }
        };

        await this.notificationService.createMany([notification]);

        this.gateway.sendToUser(event.userId, {
            type: 'PAYSLIP_GENERATED',
            title: 'Payslip Available',
            message: `Your payslip for ${event.month} ${event.year} has been generated and is now available for download.`,
        });
    }

    @OnEvent('appraisal.created')
    async handleAppraisalCreated(event: AppraisalCreatedEvent) {
        const employee = await this.prisma.user.findUnique({ where: { id: event.employeeId } });
        const notifications = event.recipientIds.map((recipientId) => ({
            recipientId,
            actorId: event.managerId,
            type: 'APPRAISAL_CREATED',
            title: 'New Appraisal',
            message: `A new appraisal has been created for you. Please log in to complete it.`,
            actionType: NotificationActionType.APPRAISAL_CREATED,
            actionData: { appraisalId: event.appraisalId }
        }));

        await this.notificationService.createMany(notifications);

        for (const recipientId of event.recipientIds) {
            this.gateway.sendToUser(recipientId, {
                type: 'APPRAISAL_CREATED',
                title: 'New Appraisal',
                message: `A new appraisal has been created for you. Please log in to complete it.`,
            });
        }

        const mailData: AppraisalMailDto = {
            email: employee.email,
            name: employee.firstName,
            dashboardUrl: process.env.CLIENT_URL || 'http://localhost:5173',
        };
        await this.mailService.sendAppraisalCreatedMail(mailData);
    }

    @OnEvent('appraisal.submitted')
    async handleAppraisalSubmitted(event: AppraisalSubmittedEvent) {
        const employee = await this.prisma.user.findUnique({ where: { id: event.employeeId } });
        const manager = await this.prisma.user.findUnique({ where: { id: event.managerId } });

        const notifications = event.recipientIds.map((recipientId) => ({
            recipientId,
            actorId: event.employeeId,
            type: 'APPRAISAL_SUBMITTED',
            title: 'Appraisal Submitted',
            message: `${employee.firstName} ${employee.lastName} has submitted their appraisal for your review.`,
            actionType: NotificationActionType.APPRAISAL_SUBMITTED,
            actionData: { appraisalId: event.appraisalId }
        }));

        await this.notificationService.createMany(notifications);

        for (const recipientId of event.recipientIds) {
            this.gateway.sendToUser(recipientId, {
                type: 'APPRAISAL_SUBMITTED',
                title: 'Appraisal Submitted',
                message: `${employee.firstName} ${employee.lastName} has submitted their appraisal for your review.`,
            });
        }

        const mailData: AppraisalMailDto = {
            email: manager.email,
            name: manager.firstName,
            employeeName: `${employee.firstName} ${employee.lastName}`,
            dashboardUrl: process.env.CLIENT_URL || 'http://localhost:5173',
        };
        await this.mailService.sendAppraisalSubmittedMail(mailData);
    }

    @OnEvent('appraisal.reviewed')
    async handleAppraisalReviewed(event: AppraisalReviewedEvent) {
        const employee = await this.prisma.user.findUnique({ where: { id: event.employeeId } });

        const notifications = event.recipientIds.map((recipientId) => ({
            recipientId,
            actorId: event.managerId,
            type: 'APPRAISAL_REVIEWED',
            title: 'Appraisal Reviewed',
            message: `Your appraisal has been reviewed by your manager. Please check the results.`,
            actionType: NotificationActionType.APPRAISAL_REVIEWED,
            actionData: { appraisalId: event.appraisalId }
        }));

        await this.notificationService.createMany(notifications);

        for (const recipientId of event.recipientIds) {
            this.gateway.sendToUser(recipientId, {
                type: 'APPRAISAL_REVIEWED',
                title: 'Appraisal Reviewed',
                message: `Your appraisal has been reviewed by your manager. Please check the results.`,
            });
        }

        const mailData: AppraisalMailDto = {
            email: employee.email,
            name: employee.firstName,
            dashboardUrl: process.env.CLIENT_URL || 'http://localhost:5173',
        };
        await this.mailService.sendAppraisalReviewedMail(mailData);
    }
}
