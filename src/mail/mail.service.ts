import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import * as fs from 'fs';
import * as path from 'path';
import * as handlebars from 'handlebars';
import { MailerService } from '@nestjs-modules/mailer';
import { SendMailParams } from './dto/mail.dto';
import { MAIL_SUBJECT } from './mail.constants';
import { Send } from 'express';

@Injectable()
export class MailService {
  // private transporter: nodemailer.Transporter;

  constructor(private mailerService: MailerService) {}

  //  async sendMail(input: ProspectInvitationDto) {
  //   const { email, firstName, token, attachments } = input;
  //   const frontendUrl = process.env.CLIENT_URL || 'http://localhost:5173';
  //   const link = `${frontendUrl}/onboarding/invitation?token=${token}`;
  //   await this.mailerService.sendMail({
  //     from: process.env.EMAIL_HOST,
  //     to: email,
  //     subject: MAIL_SUBJECT.INVITATION_OFFER,
  //     template: 'invite', // Assuming you have a template named 'invite.hbs'
  //     // attachments,
  //     context: { firstName, link, attachments}
  //   });
  // }
  

  async sendMail(input: SendMailParams) {
    const { html, subject, to, attachments } = input;
    await this.mailerService.sendMail({
      from: process.env.EMAIL_HOST,
      to,
      subject,
      html,
      attachments,
    })
  }
}
