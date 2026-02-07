import { OnEvent } from '@nestjs/event-emitter';
import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { MailService } from 'src/mail/mail.service';
import { InviteSentEvent } from 'src/events/employment.event';


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

}
