import { Injectable } from '@nestjs/common';
import { MailerService } from '@nestjs-modules/mailer';
import { AcceptanceInviteDto, ApproveLeaveRequest, DeclinedInviteDto, InitiateOffboarding, LeaveRequest, MAIL_SUBJECT, ProspectInviteDto, RejectLeaveRequest, UpdateProspectInfoDto, WelcomeEmailDto } from './mail.types';
import { ConfigService } from '@nestjs/config';
import * as Handlebars from 'handlebars';

@Injectable()
export class MailService {

  constructor(
    private mailerService: MailerService,
    private config: ConfigService,
  ) { this.registerHandlebarsHelpers(); }

    private registerHandlebarsHelpers() {
        Handlebars.registerHelper('formatDate', function(date: Date, format?: string) {
            if (!date) return '';
            
            const dateObj = new Date(date);
            const options: Intl.DateTimeFormatOptions = {};
            
            // Default format
            if (!format) {
                return dateObj.toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
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
        });

        // Additional helper for time if needed
        Handlebars.registerHelper('formatTime', function(date: Date) {
            if (!date) return '';
            return new Date(date).toLocaleTimeString('en-US', {
                hour: '2-digit',
                minute: '2-digit'
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
      context: { firstName, link, attachments }
    });
  }

  async sendAcceptanceMail(acceptance: AcceptanceInviteDto) {
    const { email, name } = acceptance;
    await this.mailerService.sendMail({
      to: email,
      subject: MAIL_SUBJECT.OFFER_ACCEPTANCE,
      template: 'acceptance',
      context: { name },
    });
  }

  async sendDeclinedMail(declined: DeclinedInviteDto) {
    const { email, name } = declined;
    await this.mailerService.sendMail({
      to: email,
      subject: MAIL_SUBJECT.DECLINE_OFFER,
      template: 'decline',
      context: { name },
    });
  }

  async sendProspectUpdateMail(data: UpdateProspectInfoDto) {
    const { email, name, comment, link } = data;
    await this.mailerService.sendMail({
      to: email,
      subject: MAIL_SUBJECT.UPDATE_USER_INFO,
      template: 'user',
      context: { name, comment, link },
    })
  }

  async initiateOffboardingMail(offboarding: InitiateOffboarding) {
    const { email, name } = offboarding;
    await this.mailerService.sendMail({
      to: email,
      subject: MAIL_SUBJECT.INITIATE_OFFBOARDING,
      template: 'offboarding',
      context: { name },
    })
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
        loginLink: loginLink || this.config.get('CLIENT_LOGIN_URL'),
        temporaryPassword,
        appName: this.config.get('APP_NAME'),
        companyName: this.config.get('COMPANY_NAME'),
        currentYear: new Date().getFullYear(),
      },
    });
  }

  async sendLeaveRequestMail(data: LeaveRequest){
    const { email, leaveType, leaveValue, name, startDate, endDate, reason } = data;
    await this.mailerService.sendMail({
      to: email,
      subject: MAIL_SUBJECT.LEAVE_REQUEST,
      template: 'leaveRequest',
      context: { name, leaveType, leaveValue, startDate, endDate, reason }
    });
  }

  async sendLeaveApprovalMail(data: ApproveLeaveRequest){
    const { email, name, startDate, endDate, leaveType, leaveValue } = data;
    await this.mailerService.sendMail({
      to: email,
      subject: MAIL_SUBJECT.LEAVE_APPROVAL,
      template: 'leaveApproved',
      context: { name, leaveType, startDate, endDate, leaveValue, },
    })
  }

  async sendLeaveRejectMail(data: RejectLeaveRequest){
    const { email, name, startDate, endDate, leaveType, leaveValue, reason } = data;
    await this.mailerService.sendMail({
      to: email,
      subject: MAIL_SUBJECT.LEAVE_DECLINE,
      template: 'leaveDenied',
      context: { name, leaveType, startDate, endDate, leaveValue, reason },
    })
  }
}
