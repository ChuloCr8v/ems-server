import { Transform } from 'class-transformer';
import {
  IsDate,
  IsEmail,
  IsNumber,
  IsOptional,
  IsString,
  IsUrl,
} from 'class-validator';

export const MAIL_SUBJECT = {
  PROSPECT_INVITATION: 'Prospect Invitation',
  OFFER_ACCEPTANCE: 'Offer Accepted',
  UPDATE_USER_INFO: 'Update User Information',
  DECLINE_OFFER: 'Declined Offer',
  INVITE_DOCUMENT_UPLOAD: 'Document Upload',
  WELCOME_EMAIL: '',
  LEAVE_REQUEST: 'New Leave Request',
  NEW_CLAIM: 'New Claim Added',
  LEAVE_APPROVAL: 'Leave Request Approved',
  LEAVE_DECLINE: 'Leave Request Denied',
  PAYSLIP_QUEUED: 'Payslip Generation Started',
  EMPLOYEE_PAYSLIP_GENERATED: 'Your Monthly Payslip is Available',
  PAYSLIPS_GENERATED: 'Monthly Payslips Generated',
  INITIATE_OFFBOARDING: 'Offboarding Initiated',
  ADD_CLAIM: 'New Claim Added',
  CLAIM_APPROVED: 'Claim Approved',
  CLAIM_REJECTED: 'Claim Rejected',
  TASK_CREATED: 'New Task Created',
  TASK_ASSIGNED: 'You Have Been Assigned a Task',
  TASK_UPDATED: 'Task Updated',
  TASK_APPROVED: 'Task Approved',
  TASK_REJECTED: 'Task Rejected',
  TASK_REASSIGNED: 'Task Reassigned',
  TASK_STATUS_CHANGED: 'Task Status Changed',
  TASK_DUEDATE_CHANGED: 'Task Due Date Changed',
  APPRAISAL_CREATED: 'New Appraisal Created',
  APPRAISAL_SUBMITTED: 'Appraisal Submitted',
  APPRAISAL_REVIEWED: 'Appraisal Reviewed',
  PIP_CREATED: 'New PIP Submitted for Review',
  PIP_RECOMMENDED: 'New PIP Recommendation',
  PIP_APPROVED: 'PIP Approved',
  PIP_REJECTED: 'PIP Rejected',
  PIP_COMPLETED: 'PIP Completed',
  REPORT_SUBMITTED: 'New Weekly Report Submitted',
};

export class ProspectInviteDto {
  @IsEmail()
  email: string;

  @IsString()
  firstName: string;

  @IsString()
  token: string;

  attachments?: Array<{
    filename: string;
    content: string | Buffer;
    contentType?: string;
    encoding?: string;
    cid?: string; // For embedded images
    path?: string; // If using file paths instead of buffers
  }>;
}

export class AcceptanceInviteDto {
  @IsEmail()
  email: string;

  @IsString()
  name: string;

  @IsString()
  role: string;
}

export class DeclinedInviteDto extends AcceptanceInviteDto { }

export class InviteDocumentUploadDto extends AcceptanceInviteDto {
  @IsString()
  role: string;
}


export class UpdateProspectInfoDto {
  @IsEmail()
  email: string;

  @IsString()
  name: string;

  @IsString()
  comment: string;

  @IsString()
  link: string;
}

export class InitiateOffboarding {
  @IsEmail()
  email: string;

  @IsString()
  name: string;
}

export class WelcomeEmailDto {
  @IsEmail({})
  email: string;

  @IsString({ message: 'Name must be a string' })
  name: string;

  @IsOptional()
  @IsString({})
  loginLink?: string;

  @IsOptional()
  @IsString({ message: 'Temporary password must be a string' })
  temporaryPassword?: string;
}

export class LeaveRequest {
  @IsEmail()
  email: string;

  @IsString()
  name: string;

  @IsString()
  approverName: string

  @IsString()
  leaveType: string;

  @IsString()
  reason: string;

  @IsNumber()
  leaveValue: number;

  @IsDate()
  @Transform(({ value }) => new Date(value))
  startDate: Date;

  @IsDate()
  @Transform(({ value }) => new Date(value))
  endDate: Date;
}

export class ClaimRequest {
  @IsEmail()
  email: string;

  @IsString()
  name: string;

  @IsString()
  approverName: string;

  @IsString()
  claimTitle: string;

  @IsString()
  type: string;

  @IsString()
  amount: string;

  @IsDate()
  @Transform(({ value }) => new Date(value))
  date: Date;

  @IsString()
  description: string;
}

export class ApproveLeaveRequest {
  @IsEmail()
  email: string;

  @IsString()
  name: string;

  @IsString()
  leaveType: string;

  @IsNumber()
  leaveValue: number;

  @IsDate()
  @Transform(({ value }) => new Date(value))
  startDate: Date;

  @IsDate()
  @Transform(({ value }) => new Date(value))
  endDate: Date;
}

export class RejectLeaveRequest extends ApproveLeaveRequest {
  @IsString()
  reason: string;
}

export class PayslipQueued {
  @IsString()
  date: string;

  @IsString()
  month: string;

  @IsString()
  email: string;
}

export class AttachmentType {
  @IsString()
  filename: string;

  content: Uint8Array<ArrayBuffer>;

  @IsString()
  contentType: string;
}

export class EmployeePayslipGenerated extends PayslipQueued {
  @IsString()
  name: string;

  @IsString()
  dashboardUrl: string;

  attachment: AttachmentType;
}

export class PayslipsGenerated {
  @IsString()
  email: string;

  @IsString()
  date: string;

  @IsString()
  month: string;

  @IsString()
  dashboardUrl: string;
}

// Task Email DTOs
export class TaskCreatedDto {
  @IsEmail()
  email: string;

  @IsString()
  name: string;

  @IsString()
  taskId: string;

  @IsString()
  taskTitle: string;

  @IsOptional()
  @IsString()
  taskDescription?: string;

  @IsOptional()
  @IsString()
  priority?: string;

  @IsOptional()
  @IsDate()
  @Transform(({ value }) => (value ? new Date(value) : undefined))
  dueDate?: Date;

  @IsString()
  dashboardUrl: string;
}

export class TaskAssignedDto {
  @IsEmail()
  email: string;

  @IsString()
  name: string;

  @IsString()
  assignedBy: string;

  @IsString()
  taskId: string;

  @IsString()
  taskTitle: string;

  // @IsOptional()
  // @IsString()
  // taskDescription?: string;

  @IsOptional()
  @IsString()
  priority?: string;

  @IsOptional()
  @IsDate()
  @Transform(({ value }) => (value ? new Date(value) : undefined))
  dueDate?: Date;

  @IsString()
  dashboardUrl: string;
}

export class TaskUpdatedDto {
  @IsEmail()
  email: string;

  @IsString()
  name: string;

  @IsString()
  updatedBy: string;

  @IsString()
  taskId: string;

  @IsString()
  taskTitle: string;

  @IsString()
  updateDetails: string;

  @IsString()
  dashboardUrl: string;
}

export class TaskApprovedDto {
  @IsEmail()
  email: string;

  @IsString()
  name: string;

  @IsString()
  approvedBy: string;

  @IsString()
  taskId: string;

  @IsString()
  taskTitle: string;

  @IsString()
  dashboardUrl: string;
}

export class TaskRejectedDto {
  @IsEmail()
  email: string;

  @IsString()
  name: string;

  @IsString()
  rejectedBy: string;

  @IsString()
  taskId: string;

  @IsString()
  taskTitle: string;

  @IsString()
  rejectionReason: string;

  @IsString()
  dashboardUrl: string;
}

export class TaskReassignedDto {
  @IsEmail()
  email: string;

  @IsString()
  name: string;

  @IsString()
  reassignedBy: string;

  @IsString()
  taskId: string;

  @IsString()
  taskTitle: string;

  @IsOptional()
  @IsString()
  note?: string;

  @IsOptional()
  @IsDate()
  @Transform(({ value }) => (value ? new Date(value) : undefined))
  newDueDate?: Date;

  @IsString()
  dashboardUrl: string;
}

export class TaskStatusChangedDto {
  @IsEmail()
  email: string;

  @IsString()
  name: string;

  @IsString()
  changedBy: string;

  @IsString()
  taskId: string;

  @IsString()
  taskTitle: string;

  @IsString()
  oldStatus: string;

  @IsString()
  newStatus: string;

  @IsString()
  reason: string;

  @IsString()
  dashboardUrl: string;
}

export class TaskDueDateChangeDto {
  @IsEmail()
  email: string;

  @IsString()
  name: string;

  @IsString()
  changedBy: string;

  @IsString()
  taskId: string;

  @IsString()
  taskTitle: string;

  @IsOptional()
  @IsDate()
  @Transform(({ value }) => (value ? new Date(value) : undefined))
  oldDueDate?: Date;

  @IsOptional()
  @IsDate()
  @Transform(({ value }) => (value ? new Date(value) : undefined))
  newDueDate?: Date;

  @IsString()
  dashboardUrl: string;
}

export class ClaimApprovalDto {
  @IsEmail()
  email: string;

  @IsString()
  name: string;

  @IsString()
  claimTitle: string;

  @IsString()
  amount: string;

  @IsDate()
  @Transform(({ value }) => new Date(value))
  date: Date;

  @IsOptional()
  @IsString()
  approverName?: string;
}

export class ClaimRejectionDto extends ClaimApprovalDto {
  @IsOptional()
  @IsString()
  reason?: string;
}

export class AppraisalMailDto {
  @IsEmail()
  email: string;

  @IsString()
  name: string;

  @IsString()
  employeeName?: string; // For manager notification

  @IsString()
  dashboardUrl: string;

  @IsString()
  companyName?: string;
}

export class PipMailDto {
  @IsEmail()
  email: string;

  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  employeeName?: string;

  @IsOptional()
  @IsString()
  pipTitle?: string;

  @IsOptional()
  @IsString()
  recommenderName?: string;

  @IsOptional()
  @IsString()
  approverName?: string;

  @IsOptional()
  @IsString()
  rejectorName?: string;
  @IsString()
  dashboardUrl: string;
}

export class ReportSubmittedMailDto {
  @IsEmail()
  email: string;

  @IsString()
  name: string;

  @IsString()
  reportTitle: string;

  @IsNumber()
  week: number;

  @IsString()
  departmentName: string;

  @IsString()
  dashboardUrl: string;
}
