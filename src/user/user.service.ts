import { BadRequestException, Injectable, NotFoundException, Logger, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { JobType, Status } from '@prisma/client';
import { AddEmployeeDto, ApproveUserDto, PartialCreateUserDto, UpdateUserDto, UpdateUserInfo } from './dto/user.dto';
import { bad } from 'src/utils/error.utils';
import { MailService } from 'src/mail/mail.service';

@Injectable()
export class UserService {
    private readonly logger = new Logger(UserService.name);

    constructor(
        private readonly prisma: PrismaService,
        private readonly mail: MailService,) { }

    async createUser(id: string, data: PartialCreateUserDto, uploads: Express.Multer.File[]) {
        const {
            jobType,
            duration, //This is conditional
        } = data;
        try {
            //First find prospect by ID
            const invite = await this.prisma.invite.findUnique({ where: { id }, include: { prospect: true } });
            if(!invite){
                throw new NotFoundException("Invite not found");
            }

            const result = await this.prisma.$transaction(async (prisma) => {
                // Create user
                const user = await prisma.user.create({
                    data: {
                        firstName: invite.prospect.firstName,
                        lastName: invite.prospect.lastName,
                        gender: invite.prospect.gender,
                        phone: invite.prospect.phone,
                        role: invite.prospect.role,
                        jobType: invite.prospect.jobType,
                        startDate: invite.prospect.startDate,
                        // Conditionally include duration
                        ...(jobType === JobType.CONTRACT ? { duration } : {}),
                        department: {
                            connect: {
                                id: invite.prospect.departmentId,
                            },
                        },
                        country: data.country,
                        state: data.state,
                        address: data.address,
                        maritalStatus: data.maritalStatus,
                        contacts: {
                            create: {
                                guarantor: {
                                    create: {
                                        firstName: data.guarantor.firstName,
                                        lastName: data.guarantor.lastName,
                                        phone: data.guarantor.phone,
                                        email: data.guarantor.email
                                    },
                                },
                                emergency: {
                                    create: {
                                        firstName: data.emergency.firstName,
                                        lastName: data.emergency.lastName,
                                        phone: data.emergency.phone,
                                        email: data.emergency.email,
                                    },
                                },
                            },
                        },
                        prospect: {
                            connect: {
                                id: invite.prospect.id,
                            },
                        },
                    },
                    include: {
                        contacts: true,
                        prospect: true
                    },
                });
                // Handle file uploads within the transaction
                if (uploads?.length > 0) {
                    const userUploads = uploads.map((upload) => ({
                        name: upload.originalname,
                        size: upload.size,
                        type: upload.mimetype,
                        bytes: upload.buffer,
                        userId: user.id,
                    }));

                    await prisma.upload.createMany({
                        data: userUploads,
                    });
                }
                return { user, uploads }
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
        const { email, workPhone, userRole, levelId, eId } = data;
        try {
            //Check if User Exists And Is Not Already ACTIVE
            const user = await this.__findUserById(id);
            const userStatus = Status.ACTIVE;
            if (user.status === userStatus) {
                bad("User is already ACTIVE")
            }
            const approveUser = await this.prisma.user.update({
                where: { id: user.id },
                data: {
                    email,
                    workPhone,
                    userRole,
                    eId,
                    level: {
                        connect: {
                            id: levelId,
                        },
                    },
                    status: userStatus,
                },
            });
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
            // Update user details
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
                        connect: {
                            id: user.departmentId,
                        },
                    },
                    ...(jobType === JobType.CONTRACT ? { duration } : {}),
                    contacts: {
                        update: {
                            emergency: {
                                upsert: {
                                    where: { contactId: user.contacts.id },
                                    update: {
                                        firstName: data.emergency.firstName,
                                        lastName: data.emergency.lastName,
                                        email: data.emergency.email,
                                        phone: data.emergency.phone
                                    },
                                    create: {
                                        firstName: data.emergency.firstName,
                                        lastName: data.emergency.lastName,
                                        email: data.emergency.email,
                                        phone: data.emergency.phone
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
                                        phone: data.guarantor.phone
                                    },
                                    create: {
                                        firstName: data.guarantor.firstName,
                                        lastName: data.guarantor.lastName,
                                        email: data.guarantor.email,
                                        phone: data.guarantor.phone
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
                        select: {
                            name: true,
                        },
                    },
                },
            });

            //Handle file uploads if they exist
            await this.handleUserUploads(user.id, uploads)
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
                level: true,
                department: true,
                contacts: {
                    include: {
                        emergency: true,
                        guarantor: true,
                    }
                },
                userDocuments:{
                    select: {
                        name: true,
                        size: true,
                        type: true,
                    }
                },
                comment: true,
                invite: true,
            }
        });
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
                    // uploads: true,
                    contacts: true,
                    department: true,
                    prospect: true,
                    assignments: true,
                },
            });
            if (!user) {
                throw new NotFoundException("User Not Found");
            };
            return user;
        } catch (error) {
      if (error instanceof BadRequestException || 
          error instanceof NotFoundException || 
          error instanceof ConflictException) {
        throw error;
      }
      throw new BadRequestException('Failed to find user by ID');
      }

    }

    async handleUserUploads(userId: string, uploads: Express.Multer.File[]) {
        if (!uploads?.length) {
            this.logger.debug('No files to upload');
            return;
        }
        try {
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
        } catch (error) {
      if (error instanceof BadRequestException || 
          error instanceof NotFoundException || 
          error instanceof ConflictException) {
        throw error;
      }
      throw new BadRequestException('Failed to handle user uploads');
      }
        
    }

    async findByEmail(email: string) {
        try {
           return this.prisma.user.findUnique({
            where: { email },
        }); 
        } catch (error) {
      if (error instanceof BadRequestException || 
          error instanceof NotFoundException || 
          error instanceof ConflictException) {
        throw error;
      }
      throw new BadRequestException('Failed to find user by email');
      }
    }

}

