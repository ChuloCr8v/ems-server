import { BadRequestException, ConflictException, HttpException, HttpStatus, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { randomUUID } from 'crypto';
import { MailService } from '../mail/mail.service';
import { CreateProspectDto, SendInviteDto } from './dto/invite.dto';
import { bad, mustHave } from 'src/utils/error.utils';
import { JobType, Role } from '@prisma/client';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { EmploymentAcceptedEvent } from 'src/events/employment.event';
import { UploadsService } from 'src/uploads/uploads.service';
import { v4 as uuidv4 } from 'uuid';
import { IAuthUser } from 'src/auth/dto/auth.dto';
import { JwtService } from '@nestjs/jwt';

@Injectable()
export class InviteService {
  private readonly logger = new Logger();
  constructor(
    private prisma: PrismaService,
    private mail: MailService,
    private eventEmitter: EventEmitter2,
    private uploadService: UploadsService,
    private jwt: JwtService

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
      console.log(error)
      if (error instanceof BadRequestException ||
        error instanceof NotFoundException ||
        error instanceof ConflictException) {
        throw error;
      }
      throw new BadRequestException('Failed to send invite');
    }
  }

  async createProspect(input: CreateProspectDto, uploads: Express.Multer.File[], adminUser: IAuthUser) {
    const {
      firstName,
      lastName,
      personalEmail,
      departments,
      jobType,
      gender,
      duration,
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
          email: personalEmail
        }
      })

      existingProspect && bad("Prospect with this email already exists")

      const prospect = await this.prisma.$transaction(async (prisma) => {

        const sender = await prisma.user.findUnique({
          where: {
            id: adminUser.sub,
            userRole: {
              hasSome: [Role.ADMIN, Role.SUPERADMIN, Role.HR]
            }
          }
        })

        if (!sender) bad("You are not authorized")

        const createdProspect = await prisma.prospect.create({
          data: {
            firstName,
            lastName,
            role,
            gender,
            phone,
            email: personalEmail,
            jobType,
            startDate,
            ...(departments?.length
              ? {
                departments: {
                  connect: departments.map((id) => ({ id })),
                },
              }
              : {}),
            ...(jobType === JobType.CONTRACT
              ? { duration }
              : {}),
          },
          include: {
            upload: true,
          },
        });

        return createdProspect;
      });

      if (uploads?.length > 0) {

        for (let index = 0; index < uploads.length; index++) {

          const uploadData = await this.uploadService.uploadFileToS3(
            uuidv4(),
            uploads[index],
            index + 1,
            adminUser

          )

          await this.prisma.prospect.update({
            where: {
              id: prospect.id
            },
            data: {
              upload: {
                connect: { id: uploadData.id }
              }
            }
          })
        }
      }

      // Send invite email
      await this.sendInvite({
        email: prospect.email,
        uploads: uploads,
      },
        adminUser.sub
      );

      return prospect;
    } catch (error) {
      console.log(error)
      if (error instanceof BadRequestException ||
        error instanceof NotFoundException ||
        error instanceof ConflictException) {
        throw error;
      }
      bad(error)
    }
  }

  async acceptInvite(token: string) {
    const currentDate = new Date();

    //Find the invite by token
    const invite = await this.prisma.invite.findUnique({
      where: { token },
      include: {
        prospect: {
          include: {
            departments: true,
            upload: true,
            invite: {
              orderBy: {
                createdAt: 'desc',
              },
              take: 1,
            },
          },
        },
        sentBy: true,
      },
    });


    const prospect = invite.prospect

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


    const user = await this.prisma.user.create({
      data: {
        firstName: prospect.firstName,
        lastName: prospect.lastName,
        personalEmail: prospect.email,
        phone: prospect.phone,
        gender: prospect.gender,
        jobType: prospect.jobType,
        duration: prospect.duration ?? null,
        startDate: prospect.startDate,
        role: prospect.role,
        prospect: { connect: { id: prospect.id } },
        prospectDocuments: {
          connect: prospect.upload.map((x) => ({ id: x.id })),
        },
        departments: {
          connect: prospect.departments.map((dept: { id: string }) => ({
            id: dept.id,
          })),
        },
      }
    });

    const payload = { sub: user.id, email: user.email, role: user.userRole };

    const recipients = await this.prisma.user.findMany({
      where: {
        userRole: {
          hasSome: [Role.ADMIN]
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

    return {
      user,
      updatedInvite,
      access_token: this.jwt.sign(payload),

    };
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
          departments: true,
          user: {
            include: {
              userDocuments: true,
            },
          },

          upload: {
            select: {
              id: true,
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
    } catch (error) {
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
              user: {
                include: {
                  contacts: {
                    include: {
                      guarantor: true,
                      emergency: true
                    }
                  }
                }
              }
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
        departments: true,

      },
    });
    if (!prospect) {
      throw new HttpException(`Prospect not found for id: ${id}`, HttpStatus.NOT_FOUND);
    }
    return prospect;
  }

}
