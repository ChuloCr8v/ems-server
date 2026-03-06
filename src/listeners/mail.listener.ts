import { OnEvent } from '@nestjs/event-emitter';
import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { MailService } from 'src/mail/mail.service';
import { InviteSentEvent } from 'src/events/employment.event';
import { ReportSubmittedEvent } from 'src/events/report.event';
import { Role } from '@prisma/client';
import { SendEmailEvent } from 'src/events/emailEvent';


@Injectable()
export class MailListener {
    constructor(
        private prisma: PrismaService,
        private mailService: MailService,
    ) { }


    @OnEvent('invite.sent')
    async handleInviteSent(event: InviteSentEvent) {
        const prospect = await this.prisma.prospect.findUnique({
            where: { id: event.prospectId },
        });

        await this.mailService.sendProspectMail({
            email: prospect.email,
            firstName: `${prospect.firstName}`,
            token: event.token,
            attachments: event.attachments,
        });
    }

    @OnEvent('emails.sent')
    async handleSendEmail(event: SendEmailEvent) {

        await this.mailService.sendEmail({
            recipients: event.recipients,
            subject: event.subject,
            message: event.message,
        });
    }

    @OnEvent('report.submitted')
    async handleReportSubmitted(event: ReportSubmittedEvent) {
        const superadmins = await this.prisma.user.findMany({
            where: {
                userRole: {
                    has: Role.SUPERADMIN
                }
            }
        });

        const dashboardUrl = process.env.CLIENT_URL || 'http://localhost:5173';

        for (const admin of superadmins) {
            await this.mailService.sendReportSubmittedMail({
                email: admin.email,
                name: admin.firstName,
                reportTitle: event.reportTitle,
                week: event.week,
                departmentName: event.departmentName,
                dashboardUrl: `${dashboardUrl}/report/department-reports`, // Adjust path as needed
            });
        }
    }

}
