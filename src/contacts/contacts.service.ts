import { Injectable } from "@nestjs/common";
import { PrismaService } from "src/prisma/prisma.service";
import { mustHave, bad } from "src/utils/error.utils";
import { ContactDto } from "./contacts.dto";

@Injectable()
export class ContactService {
    constructor(private prisma: PrismaService) { }

    async create(
        userId: string,
        data: ContactDto[],
        context: "GUARANTOR" | "EMERGENCY" | "KIN"
    ) {
        try {
            const user = await this.prisma.user.findUnique({ where: { id: userId } });
            if (!user) mustHave(user, "User not found", 404);

            const contact = await this.prisma.contacts.upsert({
                where: { userId },
                update: {},
                create: { userId },
            });

            if (context === "GUARANTOR") {

                return await this.prisma.$transaction(
                    data.map((d) =>
                        this.prisma.guarantorContact.create({
                            data: {
                                firstName: d.firstName,
                                lastName: d.lastName,
                                phone: d.phone,
                                contactId: contact.id,
                                ...(d.address ? { address: d.address } : {}),
                                ...(d.relationship ? { relationship: d.relationship } : {}),
                                ...(d.document?.length
                                    ? {
                                        document: {
                                            connect: d.document.map((doc) => ({ id: doc })),
                                        },
                                    }
                                    : {}),
                            },
                        })
                    )
                );
            }

            const createConfig = {
                data: data.map((d) => ({
                    firstName: d.firstName,
                    lastName: d.lastName,
                    phone: d.phone,
                    contactId: contact.id,
                    ...(d.address ? { address: d.address } : {}),
                    ...(d.relationship ? { relationship: d.relationship } : {}),
                })),
            };

            if (context === "EMERGENCY") {
                return await this.prisma.emergencyContact.createMany(createConfig);
            } else {
                return await this.prisma.nextOfKin.createMany(createConfig);
            }
        } catch (error) {
            bad(error);
        }
    }

    async update(
        id: string,
        data: ContactDto,
        context: "GUARANTOR" | "EMERGENCY" | "KIN"
    ) {
        try {
            const baseData = {
                firstName: data.firstName,
                lastName: data.lastName,
                phone: data.phone,
                ...(data.address ? { address: data.address } : {}),
                ...(data.relationship ? { relationship: data.relationship } : {}),
            };

            if (context === "GUARANTOR") {
                return await this.prisma.guarantorContact.update({
                    where: { id },
                    data: {
                        ...baseData,
                        ...(data.document?.length
                            ? {
                                document: {
                                    set: data.document.map((docId) => ({ id: docId })),
                                },
                            }
                            : {}),
                    },
                });
            }

            if (context === "EMERGENCY") {
                return await this.prisma.emergencyContact.update({
                    where: { id },
                    data: baseData,
                });
            }

            return await this.prisma.nextOfKin.update({
                where: { id },
                data: baseData,
            });
        } catch (error) {
            bad(error);
        }
    }

    async delete(id: string, context: "GUARANTOR" | "EMERGENCY" | "KIN") {
        try {

            if (context === "GUARANTOR") {
                return this.prisma.guarantorContact.delete({
                    where: { id },
                });
            } else if (context === "EMERGENCY") {
                return this.prisma.emergencyContact.delete({
                    where: { id }
                });
            } else {
                return this.prisma.nextOfKin.delete({
                    where: { id },
                });
            }
        } catch (error) {
            bad(error);
        }
    }

    async list(userId: string, context: "GUARANTOR" | "EMERGENCY" | "KIN") {
        try {
            if (context === "GUARANTOR") {
                const contact = await this.prisma.contacts.findUnique({
                    where: { userId },
                    include: { guarantor: true },
                });
                return contact?.guarantor ?? [];
            } else if (context === "EMERGENCY") {
                const contact = await this.prisma.contacts.findUnique({
                    where: { userId },
                    include: { emergency: true },
                });
                return contact?.emergency ?? [];
            } else {
                const contact = await this.prisma.contacts.findUnique({
                    where: { userId },
                    include: { nextOfKin: true },
                });
                return contact?.nextOfKin ?? [];
            }
        } catch (error) {
            bad(error);
        }
    }

    async getOne(userId: string, id: string, context: "GUARANTOR" | "EMERGENCY" | "KIN") {
        try {
            const contact = await this.prisma.contacts.findUnique({
                where: { userId },
            });
            if (!contact) mustHave(contact, "Contact record not found", 404);

            if (context === "GUARANTOR") {
                return this.prisma.guarantorContact.findUnique({ where: { id } });
            } else if (context === "EMERGENCY") {
                return this.prisma.emergencyContact.findUnique({ where: { id } });
            } else {
                return this.prisma.nextOfKin.findUnique({ where: { id } });
            }
        } catch (error) {
            bad(error);
        }
    }
}