import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { EntitlementDto, UpdateEntitlement } from './dto/entitlement.dto';
import { bad } from 'src/utils/error.utils';

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
                    unit
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

    async updateEntitlement(id: string, dto: UpdateEntitlement) {
        const { name, unit } = dto;
        try {
            await this.__findEntitlementById(id);
            const update = await this.prisma.entitlement.update({
                where: { id },
                data: {
                    name,
                    unit,
                },
            });
            return update;
        } catch (error) {
            if (error instanceof BadRequestException ||
                error instanceof NotFoundException ||
                error instanceof ConflictException) {
                throw error;
            }
            throw new BadRequestException('Failed to edit entitlement');
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
