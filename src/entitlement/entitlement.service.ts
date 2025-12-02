import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { EntitlementDto, UpdateEntitlementDto } from './dto/entitlement.dto';
import { bad, mustHave } from 'src/utils/error.utils';
import { EntitlementType } from '@prisma/client';

@Injectable()
export class EntitlementService {
    constructor(private readonly prisma: PrismaService) { }

    async createEntitlement(dto: EntitlementDto) {
        const { name, unit } = dto;
        try {
            const entitlement = await this.prisma.entitlement.findUnique({ where: { name } });
            if (entitlement) {
                throw bad("Entitlement already exist");
            }
            return await this.prisma.entitlement.create({
                data: {
                    name,
                    unit,
                    type: dto.type,
                    levels: dto.levels ? {
                        create: dto.levels?.map((level) => ({
                            levelId: level.levelId,
                            value: level.value,
                        })),
                    } : undefined,
                },
            });
        } catch (error) {
            if (error instanceof BadRequestException ||
                error instanceof NotFoundException ||
                error instanceof ConflictException) {
                throw error;
            }
            throw new BadRequestException('Failed to create entitlement');
        }
    }

    async getEntitlements() {
        try {
            return await this.prisma.entitlement.findMany({
                orderBy: {
                    createdAt: "desc"
                },
                include: {
                    levels: {
                        include: {
                            level: true
                        }
                    },
                }
            });
        } catch (error) {
            if (error instanceof BadRequestException ||
                error instanceof NotFoundException ||
                error instanceof ConflictException) {
                throw error;
            }
            throw new BadRequestException('Failed to fetch entitlements');
        }
    }

    async getEntitlement(id: string) {
        try {
            return await this.__findEntitlementById(id);
        } catch (error) {
            if (error instanceof BadRequestException ||
                error instanceof NotFoundException ||
                error instanceof ConflictException) {
                throw error;
            }
            throw new BadRequestException('Failed to fetch entitlement');
        }
    }

    async getEmployeeLeaveEntitlement(id: string, context: "CLAIMS" | "LEAVE") {

        const isLeave = context === "LEAVE"
        try {
            const employee = await this.prisma.user.findUnique({
                where: { id }, include: {
                    level: {
                        include: {
                            entitlements: {
                                include: { entitlement: true }
                            }
                        }
                    }
                }
            })
            if (!employee) mustHave(employee, "Account not found", 404)

            const leaveEntitlements = employee.level?.entitlements.filter(e => e.entitlement.type === (isLeave ? "LEAVE" : "CLAIMS") || e.entitlement.unit === "AMOUNT")
            return leaveEntitlements
        } catch (error) {
            bad(error)
        }
    }

    async updateEntitlement(id: string, dto: UpdateEntitlementDto) {
        const { name, unit, levels } = dto;
        try {
            await this.__findEntitlementById(id);
            const update = await this.prisma.entitlement.update({
                where: { id },
                data: {
                    name,
                    unit,
                    levels: levels ? {
                        deleteMany: {},
                        create: levels?.map((level) => ({
                            levelId: level.levelId,
                            value: level.value,
                        })),
                    } : undefined,
                },
            });
            return update;
        } catch (error) {
            bad(error)
        }
    }

    async deleteEntitlement(id: string) {
        try {
            await this.__findEntitlementById(id);
            const entitlement = await this.prisma.entitlement.delete({
                where: { id }
            });
            return entitlement;
        } catch (error) {
            if (error instanceof BadRequestException ||
                error instanceof NotFoundException ||
                error instanceof ConflictException) {
                throw error;
            }
            throw new BadRequestException('Failed to delete entitlement');
        }
    }



    /////////////////////////////////// HELPER FUNCTION //////////////////////////////
    async __findEntitlementById(id: string) {
        const entitlement = await this.prisma.entitlement.findUnique({
            where: { id }, include: { levels: true },
        });
        if (!entitlement) {
            throw bad("Entitlement Not Found");
        };
        return entitlement;
    }
}
