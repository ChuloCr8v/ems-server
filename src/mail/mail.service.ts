import { Injectable } from '@nestjs/common';
import { MailerService } from '@nestjs-modules/mailer';
import {
  AcceptanceInviteDto,
  ApproveLeaveRequest,
  ClaimApprovalDto,
  ClaimRejectionDto,
  ClaimRequest,
  DeclinedInviteDto,
  EmployeePayslipGenerated,
  InitiateOffboarding,
  LeaveRequest,
  MAIL_SUBJECT,
  PayslipQueued,
  PayslipsGenerated,
  ProspectInviteDto,
  RejectLeaveRequest,
  TaskApprovedDto,
  TaskAssignedDto,
  TaskCreatedDto,
  TaskReassignedDto,
  TaskStatusChangedDto,
  TaskUpdatedDto,
  TaskRejectedDto,
  UpdateProspectInfoDto,
  WelcomeEmailDto,
  TaskDueDateChangeDto,
  AppraisalMailDto,
  PipMailDto,
  InviteDocumentUploadDto,
  ReportSubmittedMailDto,
} from './mail.types';
import { ConfigService } from '@nestjs/config';
import * as Handlebars from 'handlebars';
import { SendEmailEvent } from 'src/events/emailEvent';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class MailService {
  constructor(
    private mailerService: MailerService,
    private prisma: PrismaService,
    private config: ConfigService,
  ) {
    this.registerHandlebarsHelpers();
  }

  private registerHandlebarsHelpers() {
    Handlebars.registerHelper(
      'formatDate',
      function (date: Date, format?: string) {
        if (!date) return '';

        const dateObj = new Date(date);
        const options: Intl.DateTimeFormatOptions = {};

        // Default format
        if (!format) {
          return dateObj.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
          });
        }

        // Custom format parsing
        if (format.includes('MMMM')) options.month = 'long';
        else if (format.includes('MMM')) options.month = 'short';
        else if (format.includes('MM')) options.month = '2-digit';

        if (format.includes('DD')) options.day = '2-digit';
        else if (format.includes('D')) options.day = 'numeric';

        if (format.includes('YYYY')) options.year = 'numeric';
        else if (format.includes('YY')) options.year = '2-digit';

        return dateObj.toLocaleDateString('en-US', options);
      },
    );

    // Additional helper for time if needed
    Handlebars.registerHelper('formatTime', function (date: Date) {
      if (!date) return '';
      return new Date(date).toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
      });
    });
  }

  async sendProspectMail(input: ProspectInviteDto) {
    const { email, firstName, token, attachments } = input;
    const frontendUrl = process.env.CLIENT_URL || 'http://localhost:5173';
    const link = `${frontendUrl}/onboarding/invitation?token=${token}`;
    await this.mailerService.sendMail({
      to: email,
      subject: MAIL_SUBJECT.PROSPECT_INVITATION,
      template: 'invite',
      attachments,
      context: { firstName, link, attachments, date: new Date().getFullYear() },
    });
  }

  async sendAcceptanceMail(acceptance: AcceptanceInviteDto) {
    const { email, name, role } = acceptance;
    await this.mailerService.sendMail({
      to: email,
      subject: MAIL_SUBJECT.OFFER_ACCEPTANCE,
      template: 'acceptance',
      context: {
        name,
        prospectName: name,
        date: new Date().getFullYear(),
        role,
      },
    });
  }

  async sendDeclinedMail(declined: DeclinedInviteDto) {
    const { email, name } = declined;
    await this.mailerService.sendMail({
      to: email,
      subject: MAIL_SUBJECT.DECLINE_OFFER,
      template: 'decline',
      context: { name, date: new Date().getFullYear() },
    });
  }

  async sendDocumentUploadMail(data: InviteDocumentUploadDto) {
    const { email, name, role } = data;
    await this.mailerService.sendMail({
      to: email,
      subject: MAIL_SUBJECT.INVITE_DOCUMENT_UPLOAD,
      template: 'inviteDocumentUpload',
      context: {
        prospectName: name,
        prospectEmail: email,
        role,
        submittedAt: new Date().toLocaleDateString('en-GB', {
          day: '2-digit',
          month: 'long',
          year: 'numeric',
        }),
        adminLink: 'https://ems.miro.zoracom.com/login',
        date: new Date().getFullYear(),
      },
    });
  }

  async sendProspectUpdateMail(data: UpdateProspectInfoDto) {
    const { email, name, comment, link } = data;
    await this.mailerService.sendMail({
      to: email,
      subject: MAIL_SUBJECT.UPDATE_USER_INFO,
      template: 'user',
      context: { name, comment, link, date: new Date().getFullYear() },
    });
  }

  async initiateOffboardingMail(offboarding: InitiateOffboarding) {
    const { email, name } = offboarding;
    await this.mailerService.sendMail({
      to: email,
      subject: MAIL_SUBJECT.INITIATE_OFFBOARDING,
      template: 'offboarding',
      context: { name, date: new Date().getFullYear() },
    });
  }

  async sendWelcomeEmail(data: WelcomeEmailDto) {
    const { email, name, loginLink, temporaryPassword } = data;

    await this.mailerService.sendMail({
      from: this.config.get('EMAIL_FROM'),
      to: email,
      subject: MAIL_SUBJECT.WELCOME_EMAIL,
      template: 'welcome',
      context: {
        name,
        loginLink: loginLink || 'https://ems.miro.zoracom.com/login',
        appName: this.config.get('Zoracom Employee Management System'),
        companyName: this.config.get('Zoracom'),
        date: new Date().getFullYear(),
      },
    });
  }

  async sendLeaveRequestMail(data: LeaveRequest) {
    const {
      email,
      leaveType,
      leaveValue,
      name,
      startDate,
      endDate,
      reason,
      approverName,
    } = data;

    const date = new Date().getFullYear();

    await this.mailerService.sendMail({
      to: email,
      subject: MAIL_SUBJECT.LEAVE_REQUEST,
      template: 'leaveRequest',
      context: {
        name,
        leaveType,
        leaveValue,
        startDate,
        endDate,
        reason,
        approverName,
        reviewLink: 'https://ems.miro.zoracom.com/leave/approval-desk',
        date,
      },
    });
  }

  async sendNewClaimMail(data: ClaimRequest) {
    const {
      email,
      name,
      claimTitle,
      type,
      amount,
      date,
      description,
      approverName,
    } = data;

    await this.mailerService.sendMail({
      to: email,
      subject: MAIL_SUBJECT.NEW_CLAIM,
      template: 'newClaim',
      context: {
        name,
        claimTitle,
        type,
        amount,
        eventDate: date,
        description,
        approverName,
        date: new Date().getFullYear(),
      },
    });
  }

  async sendClaimApprovalMail(data: ClaimApprovalDto) {
    const { email, name, claimTitle, amount, date, approverName } = data;

    await this.mailerService.sendMail({
      to: email,
      subject: MAIL_SUBJECT.CLAIM_APPROVED,
      template: 'claimApproval',
      context: {
        name,
        claimTitle,
        amount,
        eventDate: date,
        approverName,
        date: new Date().getFullYear(),
      },
    });
  }

  async sendClaimRejectionMail(data: ClaimRejectionDto) {
    const { email, name, claimTitle, amount, date, approverName, reason } =
      data;

    await this.mailerService.sendMail({
      to: email,
      subject: MAIL_SUBJECT.CLAIM_REJECTED,
      template: 'claimRejection',
      context: {
        name,
        claimTitle,
        amount,
        eventDate: date,
        approverName,
        reason,
        date: new Date().getFullYear(),
      },
    });
  }

  async sendLeaveApprovalMail(data: ApproveLeaveRequest) {
    const { email, name, startDate, endDate, leaveType, leaveValue } = data;
    await this.mailerService.sendMail({
      to: email,
      subject: MAIL_SUBJECT.LEAVE_APPROVAL,
      template: 'leaveApproved',
      context: {
        name,
        leaveType,
        startDate,
        endDate,
        leaveValue,
        date: new Date().getFullYear(),
      },
    });
  }

  async sendLeaveRejectMail(data: RejectLeaveRequest) {
    const { email, name, startDate, endDate, leaveType, leaveValue, reason } =
      data;
    await this.mailerService.sendMail({
      to: email,
      subject: MAIL_SUBJECT.LEAVE_DECLINE,
      template: 'leaveDenied',
      context: {
        name,
        leaveType,
        startDate,
        endDate,
        leaveValue,
        reason,
        date: new Date().getFullYear(),
      },
    });
  }

  async sendPayrollQueueMail(data: PayslipQueued) {
    const { month, date, email } = data;
    await this.mailerService.sendMail({
      to: email,
      subject: MAIL_SUBJECT.PAYSLIP_QUEUED,
      template: 'payslipQueued',
      context: {
        month,
        eventDate: date,
        email,
        date: new Date().getFullYear(),
      },
    });
  }

  async sendEmployeePayslipReadyMail(data: EmployeePayslipGenerated) {
    const { month, date, email, name, dashboardUrl, attachment } = data;
    await this.mailerService.sendMail({
      to: email,
      subject: MAIL_SUBJECT.EMPLOYEE_PAYSLIP_GENERATED,
      template: 'employeePayslipGenerated',
      context: {
        month,
        eventDate: date,
        email,
        name,
        dashboardUrl,
        date: new Date().getFullYear(),
      },
      attachments: attachment
        ? [
            {
              filename: attachment.filename,
              content: attachment.content,
              contentType: attachment.contentType,
            },
          ]
        : [],
    });
  }

  async sendPayslipsGenerated(data: PayslipsGenerated) {
    const { email, month, date, dashboardUrl } = data;
    await this.mailerService.sendMail({
      to: email,
      subject: MAIL_SUBJECT.PAYSLIPS_GENERATED,
      template: 'payslipsGenerated',
      context: {
        month,
        eventDate: date,
        email,
        dashboardUrl,
        date: new Date().getFullYear(),
      },
    });
  }

  // Task Email Methods
  //Notification
  async sendTaskCreatedMail(data: TaskCreatedDto) {
    const {
      email,
      name,
      taskId,
      taskTitle,
      taskDescription,
      priority,
      dueDate,
      dashboardUrl,
    } = data;
    await this.mailerService.sendMail({
      to: email,
      subject: MAIL_SUBJECT.TASK_CREATED,
      template: 'taskCreated',
      context: {
        name,
        taskId,
        taskTitle,
        taskDescription,
        priority,
        dueDate,
        dashboardUrl,
        date: new Date().getFullYear(),
      },
    });
  }

  async sendTaskAssignedMail(data: TaskAssignedDto) {
    const {
      email,
      name,
      assignedBy,
      taskId,
      taskTitle,
      priority,
      dueDate,
      dashboardUrl,
    } = data;
    await this.mailerService.sendMail({
      to: email,
      subject: MAIL_SUBJECT.TASK_ASSIGNED,
      template: 'taskAssigned',
      context: {
        name,
        assignedBy,
        taskId,
        taskTitle,
        priority,
        dueDate,
        dashboardUrl,
        date: new Date().getFullYear(),
      },
    });
  }

  //Notification
  async sendTaskUpdatedMail(data: TaskUpdatedDto) {
    const {
      email,
      name,
      updatedBy,
      taskId,
      taskTitle,
      updateDetails,
      dashboardUrl,
    } = data;
    await this.mailerService.sendMail({
      to: email,
      subject: MAIL_SUBJECT.TASK_UPDATED,
      template: 'taskUpdated',
      context: {
        name,
        updatedBy,
        taskId,
        taskTitle,
        updateDetails,
        dashboardUrl,
        date: new Date().getFullYear(),
      },
    });
  }

  async sendTaskStatusChangeMail(data: TaskStatusChangedDto) {
    const {
      email,
      name,
      changedBy,
      taskId,
      taskTitle,
      oldStatus,
      newStatus,
      reason,
      dashboardUrl,
    } = data;
    await this.mailerService.sendMail({
      to: email,
      subject: MAIL_SUBJECT.TASK_STATUS_CHANGED,
      template: 'taskStatusChanged',
      context: {
        name,
        changedBy,
        taskId,
        taskTitle,
        oldStatus,
        newStatus,
        reason,
        dashboardUrl,
        date: new Date().getFullYear(),
      },
    });
  }

  async sendTaskApprovedMail(data: TaskApprovedDto) {
    const { email, name, approvedBy, taskId, taskTitle, dashboardUrl } = data;
    await this.mailerService.sendMail({
      to: email,
      subject: MAIL_SUBJECT.TASK_APPROVED,
      template: 'taskApproved',
      context: {
        name,
        approvedBy,
        taskId,
        taskTitle,
        dashboardUrl,
        date: new Date().getFullYear(),
      },
    });
  }

  async sendTaskRejectedMail(data: TaskRejectedDto) {
    const {
      email,
      name,
      rejectedBy,
      taskId,
      taskTitle,
      rejectionReason,
      dashboardUrl,
    } = data;
    await this.mailerService.sendMail({
      to: email,
      subject: MAIL_SUBJECT.TASK_REJECTED,
      template: 'taskRejected',
      context: {
        name,
        rejectedBy,
        taskId,
        taskTitle,
        rejectionReason,
        dashboardUrl,
        date: new Date().getFullYear(),
      },
    });
  }

  async sendTaskReassignedMail(data: TaskReassignedDto) {
    const {
      email,
      name,
      reassignedBy,
      taskId,
      taskTitle,
      note,
      newDueDate,
      dashboardUrl,
    } = data;
    await this.mailerService.sendMail({
      to: email,
      subject: MAIL_SUBJECT.TASK_REASSIGNED,
      template: 'taskReassigned',
      context: {
        name,
        reassignedBy,
        taskId,
        taskTitle,
        note,
        newDueDate,
        dashboardUrl,
        date: new Date().getFullYear(),
      },
    });
  }

  async sendTaskDueDateChangeMail(data: TaskDueDateChangeDto) {
    const {
      email,
      name,
      changedBy,
      taskId,
      taskTitle,
      oldDueDate,
      newDueDate,
      dashboardUrl,
    } = data;
    await this.mailerService.sendMail({
      to: email,
      subject: MAIL_SUBJECT.TASK_DUEDATE_CHANGED,
      template: 'taskDueDateChanged',
      context: {
        name,
        changedBy,
        taskId,
        taskTitle,
        oldDueDate,
        newDueDate,
        dashboardUrl,
        date: new Date().getFullYear(),
      },
    });
  }

  async sendAppraisalCreatedMail(data: AppraisalMailDto) {
    const { email, name, dashboardUrl } = data;
    await this.mailerService.sendMail({
      to: email,
      subject: MAIL_SUBJECT.APPRAISAL_CREATED,
      template: 'appraisalCreated',
      context: { name, dashboardUrl, date: new Date().getFullYear() },
    });
  }

  async sendAppraisalSubmittedMail(data: AppraisalMailDto) {
    const { email, name, employeeName, dashboardUrl } = data;
    await this.mailerService.sendMail({
      to: email,
      subject: MAIL_SUBJECT.APPRAISAL_SUBMITTED,
      template: 'appraisalSubmitted',
      context: {
        name,
        employeeName,
        dashboardUrl,
        date: new Date().getFullYear(),
      },
    });
  }

  async sendAppraisalReviewedMail(data: AppraisalMailDto) {
    const { email, name, dashboardUrl } = data;
    await this.mailerService.sendMail({
      to: email,
      subject: MAIL_SUBJECT.APPRAISAL_REVIEWED,
      template: 'appraisalReviewed',
      context: { name, dashboardUrl, date: new Date().getFullYear() },
    });
  }

  async sendPipCreatedMail(data: PipMailDto) {
    const { email, name, employeeName, pipTitle, dashboardUrl } = data;
    await this.mailerService.sendMail({
      to: email,
      subject: MAIL_SUBJECT.PIP_CREATED,
      template: 'pipCreated',
      context: { name, employeeName, pipTitle, dashboardUrl },
    });
  }

  async sendPipRecommendedMail(data: PipMailDto) {
    const { email, name, recommenderName, dashboardUrl } = data;
    await this.mailerService.sendMail({
      to: email,
      subject: MAIL_SUBJECT.PIP_RECOMMENDED,
      template: 'pipRecommended',
      context: {
        name,
        recommenderName,
        dashboardUrl,
        date: new Date().getFullYear(),
      },
    });
  }

  async sendPipRequestMail(data: PipMailDto) {}

  async sendPipApprovedMail(data: PipMailDto) {
    const { email, name, approverName, dashboardUrl } = data;
    await this.mailerService.sendMail({
      to: email,
      subject: MAIL_SUBJECT.PIP_APPROVED,
      template: 'pipApproved',
      context: {
        name,
        approverName,
        dashboardUrl,
        date: new Date().getFullYear(),
      },
    });
  }

  async sendPipRejectedMail(data: PipMailDto) {
    const { email, name, rejectorName, dashboardUrl } = data;
    await this.mailerService.sendMail({
      to: email,
      subject: MAIL_SUBJECT.PIP_REJECTED,
      template: 'pipRejected',
      context: {
        name,
        rejectorName,
        dashboardUrl,
        date: new Date().getFullYear(),
      },
    });
  }

  async sendPipCompletedMail(data: PipMailDto) {
    const { email, name, dashboardUrl } = data;
    await this.mailerService.sendMail({
      to: email,
      subject: MAIL_SUBJECT.PIP_COMPLETED,
      template: 'pipCompleted',
      context: { name, dashboardUrl, date: new Date().getFullYear() },
    });
  }

  async sendReportSubmittedMail(data: ReportSubmittedMailDto) {
    const { email, name, reportTitle, week, departmentName, dashboardUrl } =
      data;
    await this.mailerService.sendMail({
      to: email,
      subject: MAIL_SUBJECT.REPORT_SUBMITTED,
      template: 'reportSubmitted',
      context: {
        name,
        reportTitle,
        week,
        departmentName,
        dashboardUrl,
        date: new Date().getFullYear(),
      },
    });
  }

  async sendEmail(input: SendEmailEvent) {
    const { recipients, subject, message } = input;

    const users = await this.prisma.user.findMany({
      where: {
        id: {
          in: recipients,
        },
      },
    });

    await this.mailerService.sendMail({
      to: users.map((u) => u.email),
      subject: subject,
      template: 'emailTemplate',
      context: { message, subject, date: new Date().getFullYear() },
    });
  }
}
