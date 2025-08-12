import { BadRequestException, Injectable, InternalServerErrorException, NotFoundException, Logger, HttpException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { JobType, Prisma, Role, Status } from '@prisma/client';
import { ApproveUserDto, CreateUserDto, UpdateUserDto, UpdateUserInfo } from './dto/user.dto';
import { InviteService } from 'src/invite/invite.service';
import { bad } from 'src/utils/error.utils';
import { MailService } from 'src/mail/mail.service';

@Injectable()
export class UserService {
    private readonly logger = new Logger(UserService.name);

    constructor(
        private readonly prisma: PrismaService,
        private readonly invite: InviteService,
        private readonly mail: MailService,) { }

    async createUser(id: string, data: CreateUserDto, uploads: Express.Multer.File[]) {
        const {
            jobType,
            duration, //This is conditional
        } = data;
        try {
            //First find prospect by ID
            const prospect = await this.invite.__findProspectById(id);

            const result = await this.prisma.$transaction(async (prisma) => {
                // Create user
                const user = await prisma.user.create({
                    data: {
                        firstName: prospect.firstName,
                        lastName: prospect.lastName,
                        gender: prospect.gender,
                        phone: prospect.phone,
                        role: prospect.role,
                        jobType: prospect.jobType,
                        startDate: prospect.startDate,
                        // Conditionally include duration
                        ...(jobType === JobType.CONTRACT ? { duration } : {}),
                        department: {
                            connect: {
                                id: prospect.departmentId,
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
                                id: prospect.id,
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
    if (error instanceof BadRequestException) {
      throw error;
    }
    throw new InternalServerErrorException('Failed to create user');
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
    if (error instanceof BadRequestException) {
      throw error;
    }
    throw new InternalServerErrorException('Failed to approve user');
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
         console.log(error.message)
        bad("Edit User Link could not be Sent");
    }
    }

   async updateUser(id: string, data: UpdateUserDto, uploads: Express.Multer.File[]) {

    const { duration, jobType } = data;
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
                upload: {
                    select: {
                        name: true
                    }
                },
            },
        });

        //Handle file uploads if they exist
        await this.handleUserUploads(user.id, uploads)
        return updatedUser;
    });

        return updateUser; 
    }

    async findAllUsers() {
        return this.prisma.user.findMany({
            include: {
                // prospect: true,
                upload: {
                    select: {
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



    //////////////////////////////// HELPER METHODS ////////////////////////////////

    async __findUserById(id: string) {
        try {
            const user = await this.prisma.user.findUnique({
                where: { id,},
                include: {
                    level: true,
                    upload: true,
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

}

