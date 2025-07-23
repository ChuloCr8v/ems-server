import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { randomUUID } from 'crypto';
import { MailService } from '../mail/mail.service';
import { CreateProspectDto, SendInviteDto } from './dto/invite.dto';
import { MAIL_MESSAGE, MAIL_SUBJECT } from '../mail/mail.constants';

@Injectable()
export class InviteService {
  constructor(
    private prisma: PrismaService,
    private mail: MailService,
  ) {}

  // async sendInvite(email: string) {
  //   const token = randomUUID();
  //   const expiresAt = new Date();
  //   expiresAt.setDate(expiresAt.getDate() + 2); // expires in 2 days

  //   const invite = await this.prisma.invite.create({
  //     data: { email, token, expiresAt },

  //   });
  //   await this.mailService.sendInviteEmail(email, token);

  //   return invite;
  // }

  async sendInvite(input: SendInviteDto & { uploads: Express.Multer.File[] }) {
    try {
      const { email, uploads } = input;
      const token = randomUUID();
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 2); // expires in 2 days
      await this.prisma.$transaction(async (prisma) => {
        const prospect = await this.__findProspectByEmail(email);

        await this.prisma.invite.create({
          data: {
            email: email,
            expiresAt,
            token,
            prospectId: prospect.id, 
          },
        });

        const frontendUrl = process.env.CLIENT_URL || 'http://localhost:5173';
        const link = `${frontendUrl}/onboarding/invitation?token=${token}`;

        const allAttachments = [
          ...(uploads.map(upload => ({
            filename: upload.originalname,
            content: upload.buffer,
            contentType: upload.mimetype,
          })) || []),
        ];

        await this.mail.sendMail({
          to: email,
          subject: MAIL_SUBJECT.PROSPECT_INVITATION,
          html: MAIL_MESSAGE.PROSPECT_INVITATION({
              firstName: prospect.firstName,
              link: link
          }),
          attachments: allAttachments,
        });
      });
      return true;
    } catch (error) {
      console.error("Failed to send invite:", error);
      throw new Error(`Failed to send invite link: ${error.message}`);
    }
  }


  async createProspect(input: CreateProspectDto, uploads: Express.Multer.File[]) {
    const {
        firstName,
        lastName,
        email,
        departmentId,
        jobType,
        gender,
        duration,
        phone,
        role
    } = input;

    try {
        const result = await this.prisma.$transaction(async (prisma) => {
            // 1. Create prospect
            const prospect = await prisma.prospect.create({
                data: {
                    firstName,
                    lastName,
                    role,
                    gender,
                    phone,
                    email,
                    duration,
                    jobType,
                    departmentId,
                },
                include: { upload: true },
            });

            // 2. Handle uploads within the same transaction
            if (uploads?.length > 0) {
                const prospectUploads = uploads.map((upload) => ({
                    name: upload.originalname,
                    size: upload.size,
                    type: upload.mimetype,
                    bytes: upload.buffer,
                    prospectId: prospect.id, 
                }));

                await prisma.upload.createMany({
                    data: prospectUploads,
                });
            }

            // 3. Modified sendInvite call that works within transaction
            const token = randomUUID();
            const expiresAt = new Date();
            expiresAt.setDate(expiresAt.getDate() + 2);

            // Create invite record
            await prisma.invite.create({
                data: {
                    email: prospect.email,
                    expiresAt,
                    token,
                    prospectId: prospect.id,
                },
            });

            // Send email - if this fails, the transaction will roll back
            const frontendUrl = process.env.CLIENT_URL || 'http://localhost:5173';
            const link = `${frontendUrl}/onboarding/invitation?token=${token}`;
            
            await this.mail.sendMail({
                to: prospect.email,
                subject: MAIL_SUBJECT.PROSPECT_INVITATION,
                html: MAIL_MESSAGE.PROSPECT_INVITATION({
                    firstName: prospect.firstName,
                    link: link
                }),
                attachments: uploads?.map(upload => ({
                    filename: upload.originalname,
                    content: upload.buffer,
                    contentType: upload.mimetype,
                })) || [],
            });

            return prospect;
        }, {
            timeout: 30000, // Extended timeout for email sending
            maxWait: 30000
        });

        return result;
    } catch (error) {
        throw new Error(`Failed to create prospect: ${error.message}`);
    }
}

//   async acceptInvite(body: any, files: any) {
//     const {
//       token,
//       firstName,
//       lastName,
//       email,
//       phone,
//       gender,
//       role,
//       department,
//       jobType,
//       // duration,
//     } = body;

//     const invite = await this.prisma.invite.findUnique({ where: { token } });

//     if (!invite || invite.expiresAt < new Date()) {
//       throw new Error('Invalid or expired invite');
//     }
//     if (invite.status !== 'PENDING') {
//       throw new Error('Invite has already been accepted or declined');
//     }
//     // Create user and nested employment
//     const user = await this.prisma.user.create({
//       data: {
//         email,
//         firstName,
//         lastName,
//         phone,
//         gender,
//         employment: {
//           create: {
//             role,
//             department,
//             jobType,
//             contractLetter: contractUrl,
//             nda: ndaUrl,
//             guarantorForm: guarantorUrl,
//           },
//         },
//       },
//     });

//     // ✅ Correct way to set userId via relation
//     await this.prisma.invite.update({
//       where: { token },
//        data: {
//       status: 'ACCEPTED',
//       userId: user.id, // ✅ Assign userId directly
//       acceptedAt: new Date(),
//   },
//     });

//     return { message: 'Invite accepted successfully' };
//   }

//   async rejectInvite(token: string) {
//     return this.prisma.invite.update({
//       where: { token },
//       data: { status: 'REJECTED' },
//     });
//   }

//   async findAll() {
//     return this.prisma.invite.findMany({
//       orderBy: { createdAt: 'desc' },
//       include: { user: true }, // optional: include related user
//     });
//   }

//   async findOne(id: string) {
//   return this.prisma.invite.findUnique({
//     where: { id },
//     include: { user: true },
//   });
// }


///////////////////////////////// HELPERS ///////////////////////////////

async __findProspectByEmail(email: string) {
  const prospect = await this.prisma.prospect.findUnique({
    where: { email },
    include: { upload: true },
  });
  if(!prospect) {
    throw new BadRequestException('Prospect Not Found');
  }
  return prospect;
}

}
