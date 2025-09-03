import { BadRequestException, Injectable, InternalServerErrorException } from '@nestjs/common';
import { LevelDto, UpdateLevelDto } from './dto/level.dto';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class LevelService {
    constructor(private prisma: PrismaService) { }

    async createLevel(input: LevelDto) {
        try {
            const { entitlements, ...levelData } = input;
            const level = await this.prisma.level.create({
                data: {
                    ...levelData,
                    entitlements: {
                        create: entitlements?.map(ent => ({
                            value: ent.value,
                            entitlement: {
                                connect: { id: ent.entitlementId }
                            },
                        }))
                    },
                },
                include: {
                    entitlements: {
                        include: {
                            entitlement: true,
                        }
                    }
                }
            });
            return level;
        } catch (error) {
            //    console.error(error)
            throw new BadRequestException(error.message);
        }
    }

    async getAllLevels() {
        try {
            return await this.prisma.level.findMany({
                include: {
                    entitlements: {
                        include: {
                            entitlement: true
                        },
                    },
                    users: true
                },
                orderBy: {
                    rank: 'asc'
                }
            });
        } catch (error) {
            throw new BadRequestException(error.message);
        }
    }

    async getOneLevel(id: string) {
        try {
            const level = await this.__findOneLevel(id);
            return level
        } catch (error) {
            throw new BadRequestException(error.message);
        }
    }

    async updateLevel(id: string, update: UpdateLevelDto) {
        const { entitlements, ...levelData } = update;
        try {
            await this.__findOneLevel(id);
            return await this.prisma.$transaction(async (prisma) => {
                // First update the level itself
                const updatedLevel = await prisma.level.update({
                    where: { id },
                    data: levelData,
                });

                // If entitlements are provided, update them
                if (entitlements && entitlements.length > 0) {
                    // Delete existing entitlements for this level
                    await prisma.levelEntitlement.deleteMany({
                        where: { levelId: id }
                    });

                    // Create new entitlements
                    const levelEntitlementsData = entitlements.map(ent => ({
                        levelId: id,
                        entitlementId: ent.entitlementId,
                        value: ent.value
                    }));

                    await prisma.levelEntitlement.createMany({
                        data: levelEntitlementsData
                    });
                }
                return updatedLevel;
            });
        } catch (error) {
            throw new BadRequestException(error.message);
        }
    }


    ////////////////////////////  HELPERS  ///////////////////////
    async __findOneLevel(id: string) {
        const level = await this.prisma.level.findUnique({
            where: { id },
            include: {
                entitlements: {
                    include: {
                        entitlement: true
                    }
                },
                users: true,
            }
        });
        if (!level) {
            throw new BadRequestException('Level not found');
        }
        return level;
    }
}
