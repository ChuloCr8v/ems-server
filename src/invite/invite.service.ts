import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { randomUUID } from 'crypto';
import { MailService } from '../mail/mail.service';

@Injectable()
export class InviteService {
  constructor(
    private prisma: PrismaService,
    private mailService: MailService,
  ) {}

  async sendInvite(email: string) {
    const token = randomUUID();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 2); // expires in 2 days

    const invite = await this.prisma.invite.create({
      data: { email, token, expiresAt },

    });

  //     const contractPdf = await this.pdfGen.generatePdfFromHtmlFile('contract.html');
  // const ndaPdf = await this.pdfGen.generatePdfFromHtmlFile('nda.html');
  // const guarantorPdf = await this.pdfGen.generatePdfFromHtmlFile('guarantor-form.html');

  // const attachments = [
  //   { filename: 'Contract.pdf', content: contractPdf },
  //   { filename: 'NDA.pdf', content: ndaPdf },
  //   { filename: 'Guarantor-Form.pdf', content: guarantorPdf },
  // ];

    await this.mailService.sendInviteEmail(email, token);

    return invite;
  }

  async acceptInvite(body: any, files: any) {
    const {
      token,
      firstName,
      lastName,
      email,
      phone,
      gender,
      role,
      department,
      jobType,
      // duration,
    } = body;

    const invite = await this.prisma.invite.findUnique({ where: { token } });

    if (!invite || invite.expiresAt < new Date()) {
      throw new Error('Invalid or expired invite');
    }

    // Get file paths
    const contractUrl = files?.contractLetter?.[0]?.path || null;
    const ndaUrl = files?.nda?.[0]?.path || null;
    const guarantorUrl = files?.guarantorForm?.[0]?.path || null;

    // Create user and nested employment
    const user = await this.prisma.user.create({
      data: {
        email,
        firstName,
        lastName,
        phone,
        gender,
        employment: {
          create: {
            role,
            department,
            jobType,
            contractLetter: contractUrl,
            nda: ndaUrl,
            guarantorForm: guarantorUrl,
          },
        },
      },
    });

    // ✅ Correct way to set userId via relation
    await this.prisma.invite.update({
      where: { token },
       data: {
      status: 'ACCEPTED',
      userId: user.id, // ✅ Assign userId directly
      acceptedAt: new Date(),
  },
    });

    return { message: 'Invite accepted successfully' };
  }

  async rejectInvite(token: string) {
    return this.prisma.invite.update({
      where: { token },
      data: { status: 'REJECTED' },
    });
  }

  async findAll() {
    return this.prisma.invite.findMany({
      orderBy: { createdAt: 'desc' },
      include: { user: true }, // optional: include related user
    });
  }

  async findOne(id: string) {
  return this.prisma.invite.findUnique({
    where: { id },
    include: { user: true },
  });
}

}
