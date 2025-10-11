import { Transform } from "class-transformer";
import { IsDate, IsEmail, IsNumber, IsOptional, IsString, IsUrl } from "class-validator"

export const MAIL_SUBJECT = {
    PROSPECT_INVITATION: 'Prospect Invitation',
    OFFER_ACCEPTANCE: 'Offer Acceptance',
    UPDATE_USER_INFO: 'Update User Information',
    DECLINE_OFFER: 'Declined Offer',
    WELCOME_EMAIL:  '',
    LEAVE_REQUEST: 'New Leave Request',
    LEAVE_APPROVAL: 'Leave Request Approved',
    LEAVE_DECLINE: 'Leave Request Denied',
    
    INITIATE_OFFBOARDING: 'Offboarding Initiated',
    ADD_CLAIM: 'New Claim Added',
    CLAIM_APPROVED: 'Claim Approved',
    CLAIM_REJECTED: 'Claim Rejected',
}

export class ProspectInviteDto {

    @IsEmail()
    email: string

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
}


export class DeclinedInviteDto extends AcceptanceInviteDto {}


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
    endDate: Date
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
    endDate: Date
}

export class RejectLeaveRequest extends ApproveLeaveRequest {
    @IsString()
    reason: string;
}   
