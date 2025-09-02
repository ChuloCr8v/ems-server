import { BadRequestException, Injectable, NotFoundException, Logger, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { JobType, Role, Status } from '@prisma/client';
import { AddEmployeeDto, ApproveUserDto, PartialCreateUserDto, UpdateUserDto, UpdateUserInfo } from './dto/user.dto';
import { bad, mustHave } from 'src/utils/error.utils';
import { MailService } from 'src/mail/mail.service';
import { EmploymentApprovedEvent } from 'src/events/employment.event';
import { EventEmitter2 } from '@nestjs/event-emitter';

@Injectable()
export class UserService {
    private readonly logger = new Logger(UserService.name);

    constructor(
        private readonly prisma: PrismaService,
        private readonly mail: MailService,
        private eventEmitter: EventEmitter2
    ) { }


    async createUser(
        id: string,
        data: PartialCreateUserDto
    ) {
        const { jobType, duration } = data;

        try {
            const invite = await this.prisma.invite.findUnique({
                where: { id },
                include: {
                    prospect: {
                        include: {
                            user: true
                        }
                    }
                },
            });

            if (!invite) mustHave(invite, "invitation not found", 404)

            const result = await this.prisma.$transaction(async (prisma) => {
                const existingUser = invite.prospect.user;

                const userData: any = {
                    firstName: data.firstName ?? existingUser?.firstName,
                    lastName: data.lastName ?? existingUser?.lastName,
                    gender: data.gender ?? existingUser?.gender,
                    phone: data.phone ?? existingUser?.phone,
                    role: data.role ?? existingUser?.role,
                    jobType: data.jobType ?? existingUser?.jobType,
                    startDate: data.startDate ?? existingUser?.startDate,
                    ...(jobType === JobType.CONTRACT && duration ? { duration } : {}),
                    ...(invite.prospect.departmentId
                        ? { department: { connect: { id: invite.prospect.departmentId } } }
                        : {}),
                    country: data.country ?? existingUser?.country,
                    state: data.state ?? existingUser?.state,
                    address: data.address ?? existingUser?.address,
                    maritalStatus: data.maritalStatus ?? existingUser?.maritalStatus,
                    prospect: { connect: { id: invite.prospect.id } },
                    ...(data.userDocuments?.length
                        ? {
                            userDocuments: {
                                connect: data.userDocuments.map((docId: string) => ({ id: docId })),
                            },
                        }
                        : {}),
                };

                // Optional contacts
                if (data.guarantor || data.emergency) {
                    userData.contacts = { create: {} };
                    if (data.guarantor) {
                        userData.contacts.create.guarantor = {
                            create: { ...data.guarantor },
                        };
                    }
                    if (data.emergency) {
                        userData.contacts.create.emergency = {
                            create: { ...data.emergency },
                        };
                    }
                }

                const user = await prisma.user.create({
                    data: userData,
                    include: { contacts: true, prospect: true },
                });



                return { user };
            });


            return result;
        } catch (error) {
      if (error instanceof BadRequestException || 
          error instanceof NotFoundException || 
          error instanceof ConflictException) {
        throw error;
      }
      throw new BadRequestException('Failed to create user');
      }
    }


    async approveUser(id: string, data: ApproveUserDto) {
        // const { email, workPhone, userRole, levelId, eId } = data;
        const { userRole, levelId } = data;
        try {
            //Check if User Exists And Is Not Already ACTIVE
            const user = await this.__findUserById(id);

            if (user.status === Status.ACTIVE) {
                bad("User is already ACTIVE")
            }

            // const workEmailIsTaken = await this.prisma.user.findUnique({
            //     where: {
            //         email: data.email
            //     }
            // })

            // workEmailIsTaken && bad("Email is taken already")

            const approveUser = await this.prisma.user.update({
                where: { id: user.id },
                data: {
                    // email,
                    // workPhone,
                    userRole,
                    // eId,
                    level: {
                        connect: {
                            id: levelId,
                        },
                    },
                    status: Status.ACTIVE,
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
                'employment.approved',
                new EmploymentApprovedEvent(approveUser.id, recipientIds),
            );

            return approveUser;
        } catch (error) {
      if (error instanceof BadRequestException || 
          error instanceof NotFoundException || 
          error instanceof ConflictException) {
        throw error;
      }
      throw new BadRequestException('Failed to approve user');
      }
    }

    async updateUserInfo(id: string, data: UpdateUserInfo) {
        const { comment } = data;
        try {
            //Find Existing User
            const user = await this.__findUserById(id);
            const editUser = await this.prisma.comment.create({
                data: {
                    comment,
                    user: {
                        connect: {
                            id: user.id
                        },
                    },
                },
            });

            const frontendUrl = process.env.CLIENT_URL || 'http://localhost:5173';
            const link = `${frontendUrl}/onboarding/invitation?id=${id}`;

            await this.mail.sendProspectUpdateMail({
                email: user.email,
                name: `${user.firstName}`,
                comment: editUser.comment,
                link: link,
            });

            return editUser;
        } catch (error) {
              if (error instanceof BadRequestException || 
                  error instanceof NotFoundException || 
                  error instanceof ConflictException) {
                throw error;
              }
              throw new BadRequestException('Failed to update user info');
              }
    }

    async updateUser(id: string, data: UpdateUserDto, uploads: Express.Multer.File[]) {
        const { duration, jobType } = data;
        try {
             const user = await this.__findUserById(id);

        const updateUser = await this.prisma.$transaction(async (tx) => {
            const updatedUser = await tx.user.update({
                where: { id },
                data: {
                    firstName: data.firstName,
                    lastName: data.lastName,
                    gender: data.gender,
                    phone: data.phone,
                    role: data.role,
                    country: data.country,
                    address: data.address,
                    maritalStatus: data.maritalStatus,
                    state: data.state,
                    department: {
                        connect: { id: user.departmentId },
                    },
                    ...(jobType === JobType.CONTRACT ? { duration } : {}),

                    // ✅ Update userDocuments safely
                    ...(data.userDocuments?.length
                        ? {
                            userDocuments: {
                                set: data.userDocuments.map((docId: string) => ({ id: docId })),
                            },
                        }
                        : {}),

                    contacts: {
                        update: {
                            emergency: {
                                upsert: {
                                    where: { contactId: user.contacts.id },
                                    update: {
                                        firstName: data.emergency.firstName,
                                        lastName: data.emergency.lastName,
                                        email: data.emergency.email,
                                        phone: data.emergency.phone,
                                    },
                                    create: {
                                        firstName: data.emergency.firstName,
                                        lastName: data.emergency.lastName,
                                        email: data.emergency.email,
                                        phone: data.emergency.phone,
                                    },
                                },
                            },
                            guarantor: {
                                upsert: {
                                    where: { contactId: user.contacts.id },
                                    update: {
                                        firstName: data.guarantor.firstName,
                                        lastName: data.guarantor.lastName,
                                        email: data.guarantor.email,
                                        phone: data.guarantor.phone,
                                    },
                                    create: {
                                        firstName: data.guarantor.firstName,
                                        lastName: data.guarantor.lastName,
                                        email: data.guarantor.email,
                                        phone: data.guarantor.phone,
                                    },
                                },
                            },
                        },
                    },
                },
                include: {
                    contacts: {
                        include: {
                            emergency: true,
                            guarantor: true,
                        },
                    },
                    userDocuments: {
                        select: { name: true },
                    },
                },
            });

            return updatedUser;
        });

        return updateUser;
        } catch (error) {
              if (error instanceof BadRequestException || 
                  error instanceof NotFoundException || 
                  error instanceof ConflictException) {
                throw error;
              }
              throw new BadRequestException('Failed to update user');
        }
       
    }


    async findAllUsers() {
        return this.prisma.user.findMany({
            include: {
                // prospect: true,
                userDocuments: {
                    select: {
                        id: true,
                        name: true,
                        size: true,
                        type: true
                    }
                },
                level: true,
                department: true,
                contacts: {
                    include: {
                        emergency: true,
                        guarantor: true,
                    }
                },
                comment: true,
                invite: true,
            }
        });
    }

    async getUser(id: string) {
        try {

            const user = await this.prisma.user.findUnique({
                where: {
                    id
                },
                include: {
                    prospect: true,
                    userDocuments: {
                        select: {
                            id: true,
                            name: true,
                            size: true,
                            type: true
                        }
                    },
                    level: true,
                    department: true,
                    contacts: {
                        include: {
                            emergency: true,
                            guarantor: true,
                        }
                    },
                    comment: true,
                    invite: true,
                }
            })

            if (!user) mustHave(user, "User not found", 404)
            return user

        } catch (error) {
            console.log(error)
            bad(error)
        }

    }

        async addEmployee(data: AddEmployeeDto, files?: Express.Multer.File[]) {
    const {
        jobType,
        duration,
        email,
        firstName,
        lastName,
        phone,
        departmentId,
        levelId,
        // dept,
        role, // Position (string)
        userRole, // System role (enum)
        startDate,
        country,
        state,
        maritalStatus,
        address,
        emergencyContact,
        guarantorContact,
        workPhone,
        // rank,
        eId,
    } = data;

    try {
        if (jobType === JobType.CONTRACT && !duration) {
            throw new BadRequestException('Duration is required for contract employees');
        }

        const existingUser = await this.findByEmail(email);
        if (existingUser) {
            throw new BadRequestException('Email already exists in the system');
        }
        if (!departmentId) {
            throw new BadRequestException('departmentId is required');
        }
        const departmentExists = await this.prisma.department.findUnique({
            where: { id: departmentId }
        });

        if (!departmentExists) {
            throw new BadRequestException('Department not found');
        }
        if (levelId) {
            const levelExists = await this.prisma.level.findUnique({
                where: { id: levelId }
            });

            if (!levelExists) {
                throw new BadRequestException('Level not found');
            }
        }

        const result = await this.prisma.$transaction(async (prisma) => {
            const user = await prisma.user.create({
                data: {
                    firstName,
                    lastName,
                    phone,
                    workPhone,
                    gender: data.gender,
                    role, // Position (string)
                    userRole, // System role (enum)
                    jobType,
                    startDate: new Date(startDate),
                    duration: jobType === JobType.CONTRACT ? duration : null,
                    department: {
                        connect: { id: departmentId },
                    },
                    level: {
                        connect: { id: levelId },
                    },

                    // dept,
                    // rank,
                    country,
                    state,
                    address,
                    maritalStatus,
                    email,
                    eId,
                    status: Status.ACTIVE,
                    contacts: {
                        create: {
                            emergency: {
                                create: {
                                    firstName: emergencyContact.firstName,
                                    lastName: emergencyContact.lastName,
                                    phone: emergencyContact.phone,
                                    email: emergencyContact.email,
                                },
                            },
                            guarantor: {
                                create: {
                                    firstName: guarantorContact.firstName,
                                    lastName: guarantorContact.lastName,
                                    phone: guarantorContact.phone,
                                    email: guarantorContact.email,
                                },
                            },
                        },
                    },
                },
                include: {
                    contacts: true,
                    department: true,
                    level: true,
                },
            });

            // Handle file uploads if any
            if (files?.length) {
                const uploads = files.map((file) => ({
                    name: file.originalname,
                    size: file.size,
                    type: file.mimetype,
                    bytes: file.buffer,
                    userId: user.id,
                }));

                await prisma.upload.createMany({
                    data: uploads,
                });
            }

            return { user };
        });

        // Send welcome email
        await this.mail.sendWelcomeEmail({
            email: result.user.email,
            name: `${result.user.firstName} ${result.user.lastName}`,
            loginLink: 'https://yourportal.com/login',
            temporaryPassword: 'initial123',
            //   userRole: result.user.userRole // Include role in email if needed
        });

        return {
            success: true,
            data: result.user,
            message: 'Employee added successfully',
        };
    } catch (error) {
      if (error instanceof BadRequestException || 
          error instanceof NotFoundException || 
          error instanceof ConflictException) {
        throw error;
      }
      throw new BadRequestException('Failed to add employee');
      }
    }



    //////////////////////////////// HELPER METHODS ////////////////////////////////

    async __findUserById(id: string) {
        try {
            const user = await this.prisma.user.findUnique({
                where: { id, },
                include: {
                    level: true,
                    userDocuments: true,
                    contacts: true,
                    department: true,
                    prospect: true,
                },
            });
            if (!user) {
                throw new NotFoundException("User Not Found");
            };
            return user;
        } catch (error) {
            bad("Unable to find user")
        }

    }

    async handleUserUploads(userId: string, uploads: Express.Multer.File[]) {
        if (!uploads?.length) {
            this.logger.debug('No files to upload');
            return;
        }
        return await this.prisma.$transaction(async (tx) => {
            //First delete the uploads that are being replaced
            const filenames = uploads.map(u => u.originalname);
            await tx.upload.deleteMany({
                where: {
                    userId,
                    name: { in: filenames }
                }
            });

            //Add all the new uploads
            await tx.upload.createMany({
                data: uploads.map(upload => ({
                    name: upload.originalname,
                    size: upload.size,
                    type: upload.mimetype,
                    bytes: upload.buffer,
                    userId
                }))
            });
        });
    }

    // user.service.ts

    async findByEmail(email: string) {
        return this.prisma.user.findUnique({
            where: { email },
        });
    }

}

