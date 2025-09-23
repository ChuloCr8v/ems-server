import { BadRequestException, Injectable, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AssetStatus, JobType, Prisma, Role, Status, User } from '@prisma/client';
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

    async getMe(sub: string) {
        console.log(sub)
        try {
            const me = await this.prisma.user.findUnique({
                where: {
                    id: sub
                }
            })

            return me
        } catch (error) {
            console.log(error)
            bad(error)
        }
    }

    async updateUserData(
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
                            user: true,
                        },
                    },
                },
            });

            if (!invite) mustHave(invite, "invitation not found", 404);

            const existingUser = invite.prospect.user;
            if (!existingUser) mustHave(existingUser, "user not found for prospect", 404);

            const result = await this.prisma.$transaction(async (prisma) => {
                const user = await prisma.user.update({
                    where: { id: existingUser.id },
                    data: {
                        // only update provided fields
                        ...(data.country !== undefined ? { country: data.country } : {}),
                        ...(data.state !== undefined ? { state: data.state } : {}),
                        ...(data.address !== undefined ? { address: data.address } : {}),
                        ...(data.maritalStatus !== undefined ? { maritalStatus: data.maritalStatus } : {}),
                        ...(jobType === JobType.CONTRACT && duration ? { duration } : {}),

                        ...(data.userDocuments?.length
                            ? {
                                userDocuments: {
                                    connect: data.userDocuments.map((docId: string) => ({ id: docId })),
                                },
                            }
                            : {}),
                    },
                    include: { contacts: true, prospect: true },
                });

                // Update or create contacts if passed
                if (data.guarantor || data.emergency) {
                    await prisma.contacts.upsert({
                        where: { userId: user.id },
                        update: {
                            ...(data.guarantor ? { guarantor: { upsert: { update: data.guarantor, create: data.guarantor } } } : {}),
                            ...(data.emergency ? { emergency: { upsert: { update: data.emergency, create: data.emergency } } } : {}),
                        },
                        create: {
                            userId: user.id,
                            ...(data.guarantor ? { guarantor: { create: data.guarantor } } : {}),
                            ...(data.emergency ? { emergency: { create: data.emergency } } : {}),
                        },
                    });
                }

                return { user };
            });

            return result;
        } catch (error) {
            bad(error);
        }
    }


    async updateEmployeeData(
        id: string,
        data: { eId: string; workEmail: string; workPhone: string }
    ) {
        const { workEmail, workPhone, eId } = data;
        try {
            const user = await this.prisma.user.findUnique({ where: { id } });
            !user && mustHave(user, "User not found", 404);

            const existingEId = await this.prisma.user.findFirst({
                where: {
                    eId,
                    NOT: { id },
                },
            });
            if (existingEId)
                bad(`Employee ID "${eId}" is already assigned to another employee`);

            const existingWorkPhone = await this.prisma.user.findFirst({
                where: {
                    workPhone,
                    NOT: { id },
                },
            });
            if (existingWorkPhone)
                bad(`Work phone "${workPhone}" is already assigned to another employee`);

            const existingWorkEmail = await this.prisma.user.findFirst({
                where: {
                    workEmail,
                    NOT: { id },
                },
            });
            if (existingWorkEmail)
                bad(`Work email "${workEmail}" is already assigned to another employee`);

            const updateEmployee = await this.prisma.user.update({
                where: { id },
                data: { workEmail, workPhone, eId },
            });

            return updateEmployee;
        } catch (error) {
            console.error(error);
            bad(error);
        }
    }

    async assignAssets(id: string, assetIds: string[]) {
        try {
            const user = await this.__findUserById(id);
            mustHave(user, "User not found!", 404);

            const assets = await this.prisma.asset.findMany({
                where: { id: { in: assetIds } }
            });

            if (!assets.length) mustHave(null, "Assets not found", 404);
            if (assets.length !== assetIds.length) {
                mustHave(null, "One or more assets not found", 404);
            }

            const alreadyAssigned = await this.prisma.assignment.findMany({
                where: {
                    assetId: { in: assetIds },
                    NOT: {
                        userId: undefined
                    }
                },
                include: { asset: true }
            });

            // if (alreadyAssigned.length > 0) {
            //     const names = alreadyAssigned.map(a => a.asset.name).join(", ");
            //     mustHave(null, `Assets already assigned: ${names}`, 400);
            // }

            const assignedAssets = await this.prisma.assignment.createMany({
                data: assetIds.map(assetId => ({
                    userId: id,
                    assetId,
                    status: "ASSIGNED",
                    assignedAt: new Date(),
                })),
                skipDuplicates: true,
            });

            await this.prisma.asset.updateMany({
                where: {
                    id: { in: assetIds },
                },
                data: {
                    status: "ASSIGNED", // 👈 must match AssetStatus enum
                },
            });


            const assigned = await this.prisma.user.findUnique({
                where: { id },
                include: {
                    assignments: {
                        include: { asset: true }
                    }
                }
            });

            return assigned;
        } catch (error) {
            console.error(error);
            bad(error);
        }
    }

    async approveUser(id: string, data: ApproveUserDto) {
        const { userRole, levelId } = data;
        try {
            const user = await this.__findUserById(id);

            if (user.status === Status.ACTIVE) {
                bad("User is already ACTIVE")
            }

            const approveUser = await this.prisma.user.update({
                where: { id: user.id },
                data: {
                    userRole: { set: userRole },
                    level: {
                        connect: { id: levelId },
                    },
                    status: Status.ACTIVE,
                },
            });

            const recipients = await this.prisma.user.findMany({
                where: {
                    userRole: {
                        hasSome: [Role.ADMIN, Role.FACILITY],
                    },
                },
            });


            const recipientIds = recipients.map(r => r.id)

            this.eventEmitter.emit(
                'employment.approved',
                new EmploymentApprovedEvent(approveUser.id, recipientIds),
            );

            return approveUser;
        } catch (error) {
            console.log(error)
            bad(error)
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
                    departments: {
                        connect: user.departments.map(u => ({ id: u.id })),
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
                departments: true,
                contacts: {
                    include: {
                        emergency: true,
                        guarantor: true,
                    }
                },
                comment: true,
                invite: true,
            },
            orderBy: {
                createdAt: "desc"
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
                    departments: true,
                    contacts: {
                        include: {
                            emergency: true,
                            guarantor: true,
                        }
                    },
                    comment: true,
                    invite: true,
                    assignments: {
                        include: {
                            asset: true
                        }
                    }
                }
            })

            if (!user) mustHave(user, "User not found", 404)
            return user

        } catch (error) {
            console.log(error)
            bad(error)
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
                    departments: true,
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

    async findByEmail(email: string) {
        return this.prisma.user.findUnique({
            where: { email },
        });
    }

    async addEmployee(data: AddEmployeeDto[]) {
        try {
            const isBulk = data.length > 1;

            const createdEmployees = await Promise.all(
                data.map(async (e) => {
                    const {
                        jobType,
                        duration,
                        department,
                        level,
                        firstName,
                        lastName,
                        workEmail,
                        workPhone,
                        gender,
                        role,
                        userRole,
                        eId,
                        phone,
                        email,
                    } = e;

                    // ✅ Basic required field validation
                    if (!firstName || !lastName) bad("First name and last name are required");
                    if (!gender) bad("Gender is required");
                    if (!department) bad("Department is required");
                    if (!level) bad("Level is required");
                    if (jobType === "CONTRACT" && !duration) bad("Duration is required for contract employees");

                    // ✅ Duplicate checks
                    if (workEmail) {
                        const existingWorkEmail = await this.prisma.user.findUnique({ where: { workEmail } });
                        if (existingWorkEmail) {
                            bad(`Work email ${workEmail} already belongs to ${existingWorkEmail.firstName} ${existingWorkEmail.lastName}`);
                        }
                    }
                    if (email) {
                        const existingEmail = await this.prisma.user.findUnique({ where: { email } });
                        if (existingEmail) {
                            bad(`Email ${email} already belongs to ${existingEmail.firstName} ${existingEmail.lastName}`);
                        }
                    }
                    if (workPhone) {
                        const existingWorkPhone = await this.prisma.user.findFirst({ where: { workPhone: workPhone.toString() } });
                        if (existingWorkPhone) {
                            bad(`Work phone ${workPhone} already belongs to ${existingWorkPhone.firstName} ${existingWorkPhone.lastName}`);
                        }
                    }
                    if (phone) {
                        const existingPhone = await this.prisma.user.findFirst({ where: { phone: phone.toString() } });
                        if (existingPhone) {
                            bad(`Phone ${phone} already belongs to ${existingPhone.firstName} ${existingPhone.lastName}`);
                        }
                    }
                    if (eId) {
                        const existingEid = await this.prisma.user.findUnique({ where: { eId } });
                        if (existingEid) {
                            bad(`Employee ID ${eId} already belongs to ${existingEid.firstName} ${existingEid.lastName}`);
                        }
                    }

                    let departmentConnect: { id: string }[] = [];
                    let levelConnect: { id: string };

                    if (isBulk) {
                        // connect by names (array of names)
                        const depts = await this.prisma.department.findMany({
                            where: { name: { in: department } }
                        });

                        if (depts.length !== department.length) {
                            bad(`Some departments not found: expected ${department.length}, found ${depts.length}`);
                        }

                        departmentConnect = depts.map(d => ({ id: d.id }));

                        const lvl = await this.prisma.level.findFirst({
                            where: { name: level.toLowerCase() }
                        });
                        if (!lvl) bad(`Level '${level}' does not exist`);
                        levelConnect = { id: lvl.id };

                    } else {
                        // connect by IDs (array of IDs)
                        departmentConnect = department.map((d: string) => ({ id: d }));
                        levelConnect = { id: level };
                    }


                    // ✅ Transaction to create employee
                    const result = await this.prisma.$transaction(async (prisma) => {
                        const employee = await prisma.user.create({
                            data: {
                                firstName,
                                lastName,
                                workEmail,
                                email,
                                workPhone: workPhone.toString(),
                                phone: phone.toString(),
                                gender,
                                role,
                                userRole,
                                eId,
                                departments: { connect: departmentConnect },
                                level: { connect: levelConnect },
                                jobType,
                                duration: jobType === "CONTRACT" ? duration.toString() : null,
                                status: "ACTIVE",
                            },
                        });

                        return employee;
                    });

                    // ✅ Send welcome email
                    await this.mail.sendWelcomeEmail({
                        email: result.workEmail ?? result.email,
                        name: `${result.firstName} ${result.lastName}`,
                    });

                    return result;
                })
            );

            return {
                success: true,
                data: createdEmployees,
                message: "Employees added successfully",
            };
        } catch (error) {
            this.logger.error("Failed to add employees", error.stack);
            if (error instanceof Prisma.PrismaClientKnownRequestError) {
                bad("Database error: " + error.message, 500);
            } else {
                bad(error.message || "Failed to add employee");
            }
        }
    }

    async deleteUser(ids: string[]) {
        try {
            await this.prisma.user.deleteMany({
                where: {
                    id: { in: ids },
                },
            })

            return {
                message: "users deleted successfully"
            }
        } catch (e) {
            bad(e)
        }
    }



}
