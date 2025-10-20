import { BadRequestException, Injectable, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AssetStatus, EmergencyContact, GuarantorContact, JobType, Prisma, Role, Status, User } from '@prisma/client';
import { AddEmployeeDto, ApproveUserDto, UpdateUserDto, UpdateUserInfo } from './dto/user.dto';
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
        try {
            const me = await this.prisma.user.findUnique({
                where: {
                    id: sub
                },
                include: {
                    approver: true
                }
            })

            return me
        } catch (error) {
            console.log(error)
            bad(error)
        }
    }

    async updateEmployee(id: string, data: UpdateUserDto) {
        const { duration, jobType } = data;
        const user = await this.__findUserById(id);

        return this.prisma.$transaction(async (tx) => {
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
                        connect: user.departments.map((u) => ({ id: u.id })),
                    },
                    ...(jobType === JobType.CONTRACT ? { duration } : {}),

                    ...(data.userDocuments?.length
                        ? {
                            userDocuments: {
                                set: data.userDocuments.map((docId: string) => ({
                                    id: docId,
                                })),
                            },
                        }
                        : {}),

                    contacts: {
                        update: {
                            emergency: {
                                deleteMany: {},
                                createMany: {
                                    data: data.emergency.map((contact) => ({
                                        firstName: contact.firstName,
                                        lastName: contact.lastName,
                                        phone: contact.phone,
                                        address: contact.address,
                                        relationship: contact.relationship,
                                    })),
                                },
                            },
                            guarantor: {
                                deleteMany: {},
                                create: data.guarantor.map((contact) => ({
                                    firstName: contact.firstName,
                                    lastName: contact.lastName,
                                    phone: contact.phone,
                                    address: contact.address,
                                    relationship: contact.relationship,
                                    ...(contact.document?.length
                                        ? {
                                            document: {
                                                connect: contact.document.map((d) => ({ id: d })),
                                            },
                                        }
                                        : {}),
                                })),
                            },
                            nextOfKin: {
                                deleteMany: {},
                                createMany: {
                                    data: data.nextOfKin.map((contact) => ({
                                        firstName: contact.firstName,
                                        lastName: contact.lastName,
                                        phone: contact.phone,
                                        address: contact.address,
                                    })),
                                },
                            },
                        },
                    },
                },
            });

            return updatedUser;
        });
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

    async updateUser(
        id: string,
        data: UpdateUserDto,
        context: "invite" | "employee" | "admin" = "admin",
    ) {

        const user = await this.__findUserById(id);

        const updateData: any = {};

        if ("firstName" in data) updateData.firstName = data.firstName;
        if ("lastName" in data) updateData.lastName = data.lastName;
        if ("gender" in data) updateData.gender = data.gender;
        if ("phone" in data) updateData.phone = data.phone;
        if ("role" in data) updateData.role = data.role;
        if ("country" in data) updateData.country = data.country;
        if ("address" in data) updateData.address = data.address;
        if ("state" in data) updateData.state = data.state;
        if ("maritalStatus" in data) updateData.maritalStatus = data.maritalStatus;
        if ("userRole" in data) updateData.userRole = data.userRole;

        if (context === "invite") {
            if (data.jobType === JobType.CONTRACT && data.duration) {
                updateData.duration = data.duration;
            }

            if (data.userDocuments?.length) {
                updateData.userDocuments = {
                    connect: data.userDocuments.map((docId: string) => ({ id: docId })),
                };
            }
        }

        if (context === "employee") {
            await this.ensureUniqueEmployeeFields(data, id, this.prisma);

            Object.assign(updateData, {
                ...(data.email && { email: data.email }),
                ...(data.dateOfBirth && { dateOfBirth: data.dateOfBirth }),
                ...(data.workPhone && { workPhone: data.workPhone }),
                ...(data.eId && { eId: data.eId }),
                ...(data.status && { status: data.status }),
                ...(data.levelId && {
                    level: { connect: { id: data.levelId } },
                }),
            });
        }

        if (context === "admin") {
            if (data.jobType === JobType.CONTRACT && data.duration) {
                updateData.duration = data.duration;
            }

            if (data.userDocuments?.length) {
                updateData.userDocuments = {
                    set: data.userDocuments.map((docId: string) => ({ id: docId })),
                };
            }
        }

        if (data.guarantor || data.emergency || data.nextOfKin) {
            await this.updateContacts(this.prisma, user.id, data.guarantor, data.emergency, data.nextOfKin);
        }

        if ("departments" in user && user.departments?.length) {
            updateData.departments = {
                connect: user.departments.map((d) => ({ id: d.id })),
            };
        }

        const updatedUser = await this.prisma.user.update({
            where: { id },
            data: updateData,
            include: {
                contacts: {
                    include: { emergency: true, guarantor: true },
                },
                userDocuments: {
                    select: { name: true },
                },
            },
        });

        return updatedUser;
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
                        guarantor: {
                            include: {
                                document: true
                            }
                        },
                        nextOfKin: true,
                        emergency: true
                    }
                },
                bank: true,
                comment: true,
                invite: true,
                payroll: {
                    include: {
                        user: true
                    }
                }
            },
            orderBy: {
                createdAt: "desc"
            }
        });
    }

    async getUser(id: string) {
        try {

            const user = await this.__findUserById(id)

            if (!user) mustHave(user, "User not found", 404)
            return user

        } catch (error) {
            console.log(error)
            bad(error)
        }

    }

    //////////////////////////////// HELPER METHODS ////////////////////////////////

    private async ensureUniqueEmployeeFields(
        data: UpdateUserDto,
        userId: string,
        tx: Prisma.TransactionClient,
    ) {
        const { eId, email, workPhone } = data;

        console.log(data)

        if (eId) {
            const existingEId = await tx.user.findFirst({
                where: { eId, NOT: { id: userId } },
            });
            if (existingEId)
                bad(`Employee ID "${eId}" is already assigned to another employee`);
        }

        if (workPhone) {
            const existingWorkPhone = await tx.user.findFirst({
                where: { workPhone, NOT: { id: userId } },
            });
            if (existingWorkPhone)
                bad(`Work phone "${workPhone}" is already assigned to another employee`);
        }

        if (email) {
            const existingEmail = await tx.user.findFirst({
                where: { email, NOT: { id: userId } },
            });
            if (existingEmail)
                bad(`Work email "${email}" is already assigned to another employee`);
        }
    }

    private async updateContacts(
        tx: Prisma.TransactionClient,
        userId: string,
        guarantors?: {
            firstName: string;
            lastName: string;
            phone: string;
            address?: string;
            relationship?: string;
            document?: string[];
        }[],
        emergencies?: Prisma.EmergencyContactCreateManyInput[],
        nextOfKin?: Prisma.NextOfKinCreateManyInput[],
    ) {
        const contact = await tx.contacts.upsert({
            where: { userId },
            update: {},
            create: { userId },
        });

        if (guarantors?.length) {
            await tx.guarantorContact.deleteMany({
                where: { contactId: contact.id },
            });

            for (const g of guarantors) {
                await tx.guarantorContact.create({
                    data: {
                        firstName: g.firstName,
                        lastName: g.lastName,
                        phone: g.phone,
                        address: g.address,
                        relationship: g.relationship,
                        contactId: contact.id,
                        ...(g.document?.length
                            ? {
                                document: {
                                    connect: g.document.map((docId) => ({ id: docId })),
                                },
                            }
                            : {}),
                    },
                });
            }
        }


        if (emergencies?.length) {
            await tx.emergencyContact.deleteMany({
                where: { contactId: contact.id },
            });

            await tx.emergencyContact.createMany({
                data: emergencies.map((e) => ({
                    ...e,
                    contactId: contact.id,
                })),
            });
        }

        if (nextOfKin?.length) {
            await tx.nextOfKin.deleteMany({
                where: { contactId: contact.id },
            });

            await tx.nextOfKin.createMany({
                data: nextOfKin.map((n) => ({
                    ...n,
                    contactId: contact.id,
                })),
            });
        }
    }


    async __findUserById(id: string) {
        try {
            const user = await this.prisma.user.findUnique({
                where: { id, },
                include: {
                    assignments: {
                        include: {
                            asset: true
                        }
                    },
                    level: true,
                    userDocuments: true,
                    contacts: {
                        include: {
                            guarantor: {

                                include: {
                                    document: true
                                }
                            },
                            nextOfKin: true,
                            emergency: true
                        }
                    },
                    bank: true,
                    departments: true,
                    prospect: true,
                },
            });
            if (!user) {
                throw new NotFoundException("User Not Found");
            };
            return user;
        } catch (error) {
            bad(error)
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
        const isBulk = data.length > 1;

        const emails = data.map((e) => e.email?.toLowerCase()).filter(Boolean);
        const workPhones = data.map((e) => e.workPhone?.toString()).filter(Boolean);
        const phones = data.map((e) => e.phone?.toString()).filter(Boolean);
        const eIds = data.map((e) => e.eId).filter(Boolean);

        const [existingEmails, existingWorkPhones, existingPhones, existingEids] =
            await Promise.all([
                this.prisma.user.findMany({
                    where: { email: { in: emails }, },
                    select: { email: true, firstName: true, lastName: true },
                }),
                this.prisma.user.findMany({
                    where: { workPhone: { in: workPhones } },
                    select: { workPhone: true, firstName: true, lastName: true },
                }),
                this.prisma.user.findMany({
                    where: { phone: { in: phones } },
                    select: { phone: true, firstName: true, lastName: true },
                }),
                this.prisma.user.findMany({
                    where: { eId: { in: eIds } },
                    select: { eId: true, firstName: true, lastName: true },
                }),
            ]);

        const results: {
            success: boolean;
            data?: any;
            error?: string;
            input: AddEmployeeDto;
        }[] = [];

        for (const e of data) {
            try {
                if (!e.firstName || !e.lastName) throw new Error("First name and last name are required");
                if (!e.gender) throw new Error("Gender is required");
                if (!e.department?.length) throw new Error("Department is required");
                if (e.jobType === "CONTRACT" && !e.duration)
                    throw new Error("Duration is required for contract employees");

                if (e.email) {
                    const found = existingEmails.find((u) => u.email.toLowerCase() === e.email.toLowerCase());
                    if (found) throw new Error(`Email ${e.email} already belongs to ${found.firstName} ${found.lastName}`);
                }
                if (e.workPhone) {
                    const found = existingWorkPhones.find((u) => u.workPhone === e.workPhone.toString());
                    if (found) throw new Error(`Work phone ${e.workPhone} already belongs to ${found.firstName} ${found.lastName}`);
                }
                if (e.phone) {
                    const found = existingPhones.find((u) => u.phone === e.phone.toString());
                    if (found) throw new Error(`Phone ${e.phone} already belongs to ${found.firstName} ${found.lastName}`);
                }
                if (e.eId) {
                    const found = existingEids.find((u) => u.eId === e.eId);
                    if (found) throw new Error(`Employee ID ${e.eId} already belongs to ${found.firstName} ${found.lastName}`);
                }

                // const departments = await this.prisma.department.findMany({
                //     where: { name: { in: e.department } },
                // });
                // if (departments.length !== e.department.length) {
                //     throw new Error(`Some departments not found: expected ${e.department.length}, found ${departments.length}`);
                // }

                const employeeData = {
                    firstName: e.firstName,
                    lastName: e.lastName,
                    email: e.email,
                    personalEmail: e.personalEmail,
                    workPhone: e.workPhone?.toString(),
                    phone: e.phone?.toString(),
                    gender: e.gender,
                    role: e.role,
                    userRole: e.userRole,
                    eId: e.eId,
                    departments: { connect: e.department.map((d) => ({ id: d })) },
                    ...(e.level ? { level: { connect: { id: e.level } } } : {}),
                    jobType: JobType.FULL_TIME,
                    duration: e.jobType === "CONTRACT" ? e.duration?.toString() : null,
                    status: Status.ACTIVE,
                };

                const created = await this.prisma.user.create({ data: employeeData });

                results.push({ success: true, data: created, input: e });
            } catch (err: any) {
                results.push({ success: false, error: err.message || "Unknown error", input: e });
            }
        }

        return {
            success: true,
            created: results.filter(r => r.success).map(r => r.data),
            failed: results.filter(r => !r.success).map(r => ({ error: r.error, input: r.input })),
            message: `Processed ${data.length} employees: ${results.filter(r => r.success).length} created, ${results.filter(r => !r.success).length} failed.`,
        };
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