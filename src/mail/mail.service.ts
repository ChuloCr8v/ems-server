import { Injectable } from '@nestjs/common';
import { MailerService } from '@nestjs-modules/mailer';
import { AcceptanceInviteDto, DeclinedInviteDto, InitiateOffboarding, MAIL_SUBJECT, ProspectInviteDto, UpdateProspectInfoDto } from './mail.types';

@Injectable()
export class MailService {

  constructor(private mailerService: MailerService) {}

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
}
