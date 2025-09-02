import { BadRequestException, ConflictException, HttpException, HttpStatus, Injectable, InternalServerErrorException, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { randomUUID } from 'crypto';
import { MailService } from '../mail/mail.service';
import { CreateProspectDto, SendInviteDto } from './dto/invite.dto';
import { bad, mustHave } from 'src/utils/error.utils';
import { JobType, Role } from '@prisma/client';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { EmploymentAcceptedEvent } from 'src/events/employment.event';

@Injectable()
export class InviteService {
  private readonly logger = new Logger();
  constructor(
    private prisma: PrismaService,
    private mail: MailService,
    private eventEmitter: EventEmitter2,

  ) { }

  async sendInvite(input: SendInviteDto & { uploads: Express.Multer.File[] }, adminUser: string) {
    const { email, uploads } = input;
    try {
      const token = randomUUID();
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 2); // expires in 2 days

      //Find Prospect by email
      const prospect = await this.__findProspectByEmail(email);
      await this.prisma.invite.create({
        data: {
          email: email,
          expiresAt,
          token,
          prospectId: prospect.id,
          sentById: adminUser, //This will track the who is sending the invite
        },
      });

      // Send email 
      const allAttachments = uploads?.map(upload => ({
        filename: upload.originalname,
        content: upload.buffer,
        contentType: upload.mimetype,
      })) || [];

      await this.mail.sendProspectMail({
        email: prospect.email,
        firstName: `${prospect.firstName}`,
        token,
        attachments: allAttachments,
      });

      return true;
    } catch (error) {
      if (error instanceof BadRequestException || 
          error instanceof NotFoundException || 
          error instanceof ConflictException) {
        throw error;
      }
      throw new BadRequestException('Failed to send invite');
      }
  }

  async createProspect(input: CreateProspectDto, uploads: Express.Multer.File[], adminUser: string) {
    const {
      firstName,
      lastName,
      email,
      departmentId,
      jobType,
      gender,
      duration, //conditional
      phone,
      role,
      startDate,
    } = input;
    try {

      if (jobType === JobType.CONTRACT && !duration) {
        throw bad('Duration is required for CONTRACT positions');
      }
      if (jobType !== JobType.CONTRACT && duration) {
        throw bad('Duration should only be provided for CONTRACT positions')
      }

      const existingProspect = await this.prisma.prospect.findUnique({
        where: {
          email: email
        }
      })

      existingProspect && bad("Prospect with this email already exists")
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

      // Send invite email
      await this.sendInvite({
        email: prospect.email,
        uploads: uploads,
      },
        adminUser
      );

      return prospect;
    } catch (error) {
          if (error instanceof BadRequestException || 
              error instanceof NotFoundException || 
              error instanceof ConflictException) {
            throw error;
          }
          throw new BadRequestException('Failed to create prospect');
          }
  }


  async acceptInvite(token: string) {
    const currentDate = new Date();
    try {
       //Find the invite by token
      const invite = await this.prisma.invite.findUnique({
        where: { token },
        include: {
          prospect: true,
          sentBy: true,
        },
      });

      if (!invite || invite.expiresAt < currentDate) {
        bad('Invalid or Expired Invitation');
      }

      if (invite.status !== 'PENDING') bad('Invitation Has Already Been Accepted or Declined');

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

      const recipients = await this.prisma.user.findMany({
        where: {
          userRole: {
            in: [Role.ADMIN, Role.FACILITY]
          }
        }
      })

      const recipientIds = recipients.map(r => r.id)

      this.eventEmitter.emit(
        'employment.accepted',
        new EmploymentAcceptedEvent(updatedInvite.prospectId, recipientIds),
      );

      await this.mail.sendAcceptanceMail({
        email: updatedInvite.sentBy.email,
        name: `${updatedInvite.prospect.firstName} ${updatedInvite.prospect.lastName}`.trim(),
      });

      return updatedInvite;
    
    } catch (error) {
          if (error instanceof BadRequestException || 
              error instanceof NotFoundException || 
              error instanceof ConflictException) {
            throw error;
          }
          throw new BadRequestException('Failed to accept invite');
          }
  }

  async declineInvite(token: string, reasons?: Array<string>) {
    const currentDate = new Date();
    try {
       const invite = await this.prisma.invite.findUnique({
        where: { token },
        include: {
          prospect: true,
          sentBy: true
        },
      });
      if (!invite || invite.expiresAt < currentDate) {
        throw new BadRequestException('Invalid or Expired Invitation')
      }
      if (invite.status !== 'PENDING') {
        throw new BadRequestException('Invitation Has Already Been Accepted or Declined')
      }

      //Update Invite Status to DECLINED
      const updatedInvite = await this.prisma.invite.update({
        where: { token },
        data: {
          status: 'DECLINED',
          declinedAt: currentDate,
          declineReasons: reasons.map(r => r),
        },
        include: { 
          prospect: true,
          sentBy: true,
        },
      });

      await this.mail.sendDeclinedMail({
        email: invite.sentBy.email,
        name: `${updatedInvite.prospect.firstName} ${updatedInvite.prospect.lastName}`.trim(),
      });

      return updatedInvite;
    } catch (error) {
          if (error instanceof BadRequestException || 
              error instanceof NotFoundException || 
              error instanceof ConflictException) {
            throw error;
          }
          throw new BadRequestException('Failed to decline invite');
          }
  }

  async getAllProspects() {
    try {
      const prospects = await this.prisma.prospect.findMany({
        where: {
          OR: [
            { user: null }, // prospects without user
            {
              user: {
                status: { in: ["PENDING"] }, // prospects with user in PENDING or INACTIVE
              },
            },
          ],
        },
        include: {
          user: {
            include: {
              userDocuments: true,
            },
          },
          upload: {
            select: {
              name: true,
              size: true,
              type: true,
            },
          },
          invite: {
            include: {
              sentBy: {
                select: {
                  id: true,
                  email: true,
                  firstName: true,
                  lastName: true,
                },
              },
            },
            take: 1,
            orderBy: {
              createdAt: "desc",
            },
          },
        },
        orderBy: {
          createdAt: "desc",
        },
      });

      return prospects;
    } catch(error) {
          if (error instanceof BadRequestException || 
              error instanceof NotFoundException || 
              error instanceof ConflictException) {
            throw error;
          }
          throw new BadRequestException('Failed to fetch prospect');
          }
  }

  async getInviteByToken(token: string) {
    try {
      const invite = await this.prisma.invite.findUnique({
        where: { token },
        include: {
          prospect: {
            include: {
              user: true
            }
          },
        },

      });

      if (!invite) {
        mustHave(invite, 'Invite not found', 404);
      }

      return invite;

    } catch (error) {
          if (error instanceof BadRequestException || 
              error instanceof NotFoundException || 
              error instanceof ConflictException) {
            throw error;
          }
          throw new BadRequestException('Failed to fetch invite');
          }
  }

  async getOneProspect(id: string) {
    try {
      return await this.__findProspectById(id);
    } catch (error) {
          if (error instanceof BadRequestException || 
              error instanceof NotFoundException || 
              error instanceof ConflictException) {
            throw error;
          }
          throw new BadRequestException('Failed to fetch prospect');
          }
  }

  async deleteProspect(id: string) {
    try {
      const prospect = await this.__findProspectById(id);
      if (!prospect) {
        mustHave(prospect, `Prospect with ID ${id} not found`, 404);
      }

      // Delete the prospect
      await this.prisma.prospect.delete({
        where: { id },
      });

      return true;
    } catch (error) {
          if (error instanceof BadRequestException || 
              error instanceof NotFoundException || 
              error instanceof ConflictException) {
            throw error;
          }
          throw new BadRequestException('Failed to delete prospect');
          }
  }


  ///////////////////////////////// HELPERS ///////////////////////////////

  async __findProspectByEmail(email: string) {
    const prospect = await this.prisma.prospect.findUnique({
      where: { email },
      include: { upload: true },
    });
    if (!prospect) {
      throw new HttpException(`Prospect not found for Email: ${email}`, HttpStatus.NOT_FOUND);
    }
    return prospect;
  }

  async __findProspectById(id: string) {
    const prospect = await this.prisma.prospect.findUnique({
      where: { id },
      include: {
        upload: true,
        user: true,
      },
    });
    if (!prospect) {
      throw new HttpException(`Prospect not found for id: ${id}`, HttpStatus.NOT_FOUND);
    }
    return prospect;
  }

}
