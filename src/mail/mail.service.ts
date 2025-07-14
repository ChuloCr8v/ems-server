import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import * as fs from 'fs';
import * as path from 'path';
import * as handlebars from 'handlebars';

@Injectable()
export class MailService {
  private transporter: nodemailer.Transporter;

  constructor(private configService: ConfigService) {
    this.transporter = nodemailer.createTransport({
      host: this.configService.get<string>('EMAIL_HOST'),
      port: this.configService.get<number>('EMAIL_PORT'),
      secure: this.configService.get<string>('EMAIL_SECURE') === 'true',
      auth: {
        user: this.configService.get<string>('EMAIL_ID'),
        pass: this.configService.get<string>('EMAIL_PASS'),
      },
    });
  }

  private compileTemplate(templateName: string, context: any): string {
    const isProduction = this.configService.get<string>('NODE_ENV') === 'production';

    const basePath = isProduction
      ? path.join(__dirname, 'templates') // dist/mail/templates
      : path.join(process.cwd(), 'src', 'mail', 'templates'); // src/mail/templates

    const filePath = path.join(basePath, `${templateName}.hbs`);
    const source = fs.readFileSync(filePath, 'utf-8');
    const template = handlebars.compile(source);
    return template(context);
  }

  async sendInviteEmail(to: string, token: string) {
    const frontendUrl = this.configService.get<string>('FRONTEND_URL') || 'http://localhost:5173';
    const inviteLink = `${frontendUrl}/onboarding/invitation?token=${token}`;
    const html = this.compileTemplate('invite', { inviteLink });

    await this.transporter.sendMail({
      from: this.configService.get<string>('EMAIL_FROM'),
      to,
      subject: 'You have been invited to EMS',
      html,
    });
  }
}
