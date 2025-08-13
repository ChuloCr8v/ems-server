import { Injectable } from '@nestjs/common';
import { MailerService } from '@nestjs-modules/mailer';
import { AcceptanceInviteDto, DeclinedInviteDto, MAIL_SUBJECT, ProspectInviteDto, UpdateProspectInfoDto } from './mail.types';

@Injectable()
export class MailService {

  constructor(private mailerService: MailerService) {}

   async sendProspectMail(input: ProspectInviteDto) {
    const { email, firstName, token, attachments } = input;
    const frontendUrl = process.env.CLIENT_URL || 'http://localhost:5173';
    const link = `${frontendUrl}/onboarding/invitation?token=${token}`;
    await this.mailerService.sendMail({
      // from: process.env.EMAIL_FROM,
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
      // from: process.env.EMAIL_FROM,
      to: email,
      subject: MAIL_SUBJECT.OFFER_ACCEPTANCE,
      template: 'acceptance',
      context: { name, link },
    });
  }

  async sendDeclinedMail(declined: DeclinedInviteDto) {
    const { email, name, link } = declined;
    await this.mailerService.sendMail({
      // from: process.env.EMAIL_FROM,
      to: email,
      subject: MAIL_SUBJECT.DECLINE_OFFER,
      template: 'decline',
      context: { name, link },
    });
  }

  async sendProspectUpdateMail(data: UpdateProspectInfoDto) {
    const { email, name, comment, link } = data;
    await this.mailerService.sendMail({
      // from: process.env.EMAIL_FROM,
      to: email,
      subject: MAIL_SUBJECT.UPDATE_USER_INFO,
      template: 'user',
      context: { name, comment, link },
    })
  }
}
