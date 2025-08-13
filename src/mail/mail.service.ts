import { Injectable } from '@nestjs/common';
import { MailerService } from '@nestjs-modules/mailer';
import { AcceptanceInviteDto, DeclinedInviteDto, MAIL_SUBJECT, ProspectInviteDto, UpdateProspectInfoDto, WelcomeEmailDto } from './mail.types';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class MailService {

  constructor(private mailerService: MailerService,
      private config: ConfigService,
  ) {}

   async sendProspectMail(input: ProspectInviteDto) {
    const { email, firstName, token, attachments } = input;
    const frontendUrl = process.env.CLIENT_URL || 'http://localhost:5173';
    const link = `${frontendUrl}/onboarding/invitation?token=${token}`;
    await this.mailerService.sendMail({
      from: process.env.EMAIL_HOST,
      to: email,
      subject: MAIL_SUBJECT.PROSPECT_INVITATION,
      template: 'invite', // Assuming you have a template named 'invite.hbs'
      attachments,
      context: { firstName, link, attachments}
    });
  }
  
  async sendAcceptanceMail(acceptance: AcceptanceInviteDto) {
    const { email, name, link } = acceptance;
    await this.mailerService.sendMail({
      from: process.env.EMAIL_HOST,
      to: email,
      subject: MAIL_SUBJECT.OFFER_ACCEPTANCE,
      template: 'acceptance',
      context: { name, link },
    });
  }

  async sendDeclinedMail(declined: DeclinedInviteDto) {
    const { email, name, link } = declined;
    await this.mailerService.sendMail({
      from: process.env.EMAIL_HOST,
      to: email,
      subject: MAIL_SUBJECT.DECLINE_OFFER,
      template: 'decline',
      context: { name, link },
    });
  }

  async sendProspectUpdateMail(data: UpdateProspectInfoDto) {
    const { email, name, comment, link } = data;
    await this.mailerService.sendMail({
      from: process.env.EMAIL_HOST,
      to: email,
      subject: MAIL_SUBJECT.UPDATE_USER_INFO,
      template: 'user',
      context: { name, comment, link },
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
}
