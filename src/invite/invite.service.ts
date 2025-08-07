import { BadRequestException, HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { randomUUID } from 'crypto';
import { MailService } from '../mail/mail.service';
import { CreateProspectDto, DeclineComment, SendInviteDto } from './dto/invite.dto';
import { MAIL_MESSAGE, MAIL_SUBJECT } from '../mail/mail.constants';
import { bad } from 'src/utils/error.utils';
import { IAuthUser } from 'src/auth/dto/auth.dto';
import { JobType } from '@prisma/client';

@Injectable()
export class InviteService {
   private readonly logger = new Logger();
  constructor(
    private prisma: PrismaService,
    private mail: MailService,
    // private auth: AuthService,
  ) {}

     async sendInvite(input: SendInviteDto & { uploads: Express.Multer.File[] },) {
      const { email, uploads } = input;
      try {
        const token = randomUUID();
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 2); // expires in 2 days

        // 1. Find Prospect by email
        const prospect = await this.__findProspectByEmail(email);
        await this.prisma.invite.create({
          data: {
            email: email,
            expiresAt,
            token,
            prospectId: prospect.id,
            // sentById: adminUser.sub, //This will track the who is sending the invite
          },
        });

        // 2. Send email 
        const frontendUrl = process.env.CLIENT_URL || 'http://localhost:5173';
        const link = `${frontendUrl}/onboarding/invitation?token=${token}`;

        const allAttachments = uploads?.map(upload => ({
          filename: upload.originalname,
          content: upload.buffer,
          contentType: upload.mimetype,
        })) || [];

        await this.mail.sendMail({
          to: email,
          subject: MAIL_SUBJECT.PROSPECT_INVITATION,
          html: MAIL_MESSAGE.PROSPECT_INVITATION({
            firstName: prospect.firstName,
            link: link
          }),
          attachments: allAttachments,
        });

        return true;
          } catch (error) {
            bad("Invite was not sent")
          }
        }
       


        async createProspect(input: CreateProspectDto, uploads: Express.Multer.File[], ) {
          const {
              firstName,
              lastName,
              email,
              departmentId,
              jobType,
              gender,
              duration, //This is conditional
              phone,
              role,
              startDate,
          } = input;

          try {

            if(jobType === JobType.CONTRACT && !duration){
              throw new BadRequestException('Duration is required for CONTRACT positions');
            }
            if(jobType !== JobType.CONTRACT && duration) {
              throw new BadRequestException('Duration should only be provided for CONTRACT positions')
            }
              // 1. Create prospect and uploads
              const prospect = await this.prisma.$transaction(async (prisma) => {
                  const createdProspect = await prisma.prospect.create({
                      data: {
                          firstName,
                          lastName,
                          role,
                          gender,
                          phone,
                          email,
                          departmentId,
                          jobType,
                          startDate,
                          // Conditionally include duration
                          ...(jobType === JobType.CONTRACT ? { duration } : {}),
                      },
                      include: { upload: true },
                  });

                  if (uploads?.length > 0) {
                      const prospectUploads = uploads.map((upload) => ({
                          name: upload.originalname,
                          size: upload.size,
                          type: upload.mimetype,
                          bytes: upload.buffer,
                          prospectId: createdProspect.id,
                      }));

                      await prisma.upload.createMany({
                          data: prospectUploads,
                      });
                  }
                  return createdProspect;
              });

              // 2. Send invite email
              await this.sendInvite({
                  email: prospect.email,
                  uploads: uploads,
              }, );

              return prospect;
          } catch (error) {
              throw new Error(`Failed to create prospect: ${error.message}`);
              // console.log(error.message);
              // bad("Prospect Not Invited")
          }
      }
      

    async acceptInvite(token: string, user: IAuthUser) {
      const currentDate = new Date();
      //Find the invite by token
      const invite = await this.prisma.invite.findUnique({
        where: { token },
        include: {
          prospect: true,
          sentBy: true,
        },
      });
      if (!invite || invite.expiresAt < currentDate) {
        throw new BadRequestException('Invalid or Expired Invitation');
      }
      if (invite.status !== 'PENDING') {
        throw new BadRequestException('Invitation Has Already Been Accepted or Declined');
      }

      //Update the invite status to ACCEPTED
     const updatedInvite = await this.prisma.invite.update({
        where: { token },
        data: {
          status: 'ACCEPTED',
          acceptedAt: currentDate,
        },
        include: {
          prospect: true,
          sentBy: true,
        },
      });
      
      await this.mail.sendMail({
        to: updatedInvite.sentBy.email,
        subject: MAIL_SUBJECT.OFFER_ACCEPTANCE,
        html: MAIL_MESSAGE.OFFER_ACCEPTANCE({
          firstName: updatedInvite.prospect.firstName,
          lastName: updatedInvite.prospect.lastName,
        }),
      });
      return updatedInvite;
    }

    async declineInvite(token: string, data: DeclineComment, user: IAuthUser) {
      const {comment} = data;
      const currentDate = new Date();

      //Find the invitation by token
      const invite = await this.prisma.invite.findUnique({
        where: { token },
        include: {
          prospect: true,
          sentBy: true
        },
      });
      if(!invite || invite.expiresAt < currentDate) {
        throw new BadRequestException('Invalid or Expired Invitation')
      }
      if(invite.status !== 'PENDING') {
        throw new BadRequestException('Invitation Has Already Been Accepted or Declined')
      }

      //Update Invite Status to DECLINED
      const updatedInvite = await this.prisma.invite.update({
        where: { token },
        data: {
          status: 'DECLINED',
          declinedAt: currentDate,
          comment: {
            create: { comment },
          },
        },
        include: {
          prospect: true,
          sentBy: true,
        },
      });

      await this.mail.sendMail({
        // to: "stephanie@zoracom.com",
        to: updatedInvite.sentBy.email,
        subject: MAIL_SUBJECT.DECLINE_OFFER,
        html: MAIL_MESSAGE.DECLINE_OFFER({
          firstName: updatedInvite.prospect.firstName,
          lastName: updatedInvite.prospect.lastName,
        }),
      });
      return updatedInvite;
    }

    async getAllProspects() {
        try {
            const prospects = await this.prisma.prospect.findMany({
                include: {
                  upload: {
                    select: {
                      name: true,
                      size: true,
                      type: true
                    }
                  }
                },
            });
            return prospects;
        } catch (error) {
            throw new Error(`Failed to fetch prospects: ${error.message}`);
        }
    }

    async getOneProspect(id: string) {
      try {
           return await this.__findProspectById(id);
      } catch (error) {
        console.log(error.message);
        throw new Error(`Failed to fetch Prospect: ${error.message}`);
      }
    }



///////////////////////////////// HELPERS ///////////////////////////////

async __findProspectByEmail(email: string) {
  const prospect = await this.prisma.prospect.findUnique({
    where: { email },
    include: { upload: true },
  });
  if(!prospect) {
    throw new HttpException(`Prospect not found for Email: ${email}`, HttpStatus.NOT_FOUND);
  }
  return prospect;
}

async __findProspectById(id: string) {
  const prospect = await this.prisma.prospect.findUnique({
    where: { id },
    include: { upload: true },
  });
  if(!prospect) {
     throw new HttpException(`Prospect not found for id: ${id}`, HttpStatus.NOT_FOUND);
  }
  return prospect;
}

}
