import { Injectable } from '@nestjs/common';
import { SendEmailDto } from './email.dto';
import { bad } from 'src/utils/error.utils';
import { PrismaService } from 'src/prisma/prisma.service';
import { EmailTo } from '@prisma/client';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { SendEmailEvent } from 'src/events/emailEvent';

@Injectable()
export class EmailsService {
  constructor(
    private readonly prisma: PrismaService,
    private eventEmitter: EventEmitter2,
  ) {}

  async sendEmail(body: SendEmailDto) {
    const { to, recipients, subject, message } = body;

    try {
      let recipientEmails: string[] = [];
      switch (to) {
        case EmailTo.DEPARTMENTS:
          const department = await this.prisma.department.findMany({
            where: {
              id: {
                in: recipients,
              },
            },
            select: {
              user: {
                where: { status: 'ACTIVE' },
                select: {
                  id: true,
                  email: true,
                },
              },
            },
          });

          const deptEmails = department.flatMap((d) => d.user.map((u) => u.id));
          recipientEmails = deptEmails;
          break;
        case EmailTo.EMPLOYEES:
          const employees = await this.prisma.user.findMany({
            where: {
              id: {
                in: recipients,
              },
              status: 'ACTIVE',
            },
            select: {
              id: true,
            },
          });
          const employeeEmails = employees.map((e) => e.id);
          recipientEmails = employeeEmails;

          break;
        case EmailTo.ZORANS:
          const zorans = await this.prisma.user.findMany({
            where: {
              status: 'ACTIVE',
            },
            select: {
              id: true,
            },
          });
          const zoransEmails = zorans.map((z) => z.id);
          recipientEmails = zoransEmails;

          break;
        default:
          break;
      }

      this.eventEmitter.emit(
        'emails.sent',
        new SendEmailEvent(recipientEmails, subject, message),
      );

      return {
        message: 'Email sent',
      };
    } catch (error) {
      bad(error);
    }
  }
}
