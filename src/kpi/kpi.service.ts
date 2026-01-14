import { Injectable, BadRequestException, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { KpiCategoryStatus, KpiCategoryType, Role } from '@prisma/client';
import { CreateKpiCategoryDto, CreateKpiDto, CreateKpiObjectiveDto } from './dto/kpi.dto';
import { UserService } from 'src/user/user.service';
import { bad } from 'src/utils/error.utils';

@Injectable()
export class KpiService {
    constructor(private readonly prisma: PrismaService, private readonly userService: UserService) { }

    // Admin Methods - Global KPIs
    async createCategory(userId: string, data: CreateKpiDto) {
        const user = await this.findUserById(userId);
        const { categories } = data;
        // If user is ADMIN -> create global categories/objectives
        if (this.userHasRole(user, Role.ADMIN)) {
            try {
                const createdOrExisting = await Promise.all(
                    categories.map(async (cat) => {
                        // Check if STATIC KPI category already exists by name
                        const existing = await this.prisma.kpiCategory.findFirst({
                            where: {
                                name: cat.name,
                                type: cat.type,
                                isGlobal: true,
                            },
                            include: { objectives: true },
                        });

                        // If it's ORGANIZATIONAL and exists, skip creation
                        if (existing && cat.type === KpiCategoryType.ORGANIZATIONAL) {
                            return existing;
                        }

                        // Otherwise, create new (for DEPARTMENTAL or new ORGANIZATIONAL)
                        return await this.prisma.kpiCategory.create({
                            data: {
                                name: cat.name,
                                type: cat.type,
                                isGlobal: cat.isGlobal ?? true,
                                status: KpiCategoryStatus.APPROVED,
                                objectives: cat.objectives?.length
                                    ? {
                                        create: cat.objectives.map((obj) => ({
                                            name: obj.name,
                                            rating: null,
                                            comment: null,
                                        })),
                                    }
                                    : undefined,
                            },
                        });
                    })
                );

                return createdOrExisting;
            } catch (error) {
                console.error(error);
                throw new BadRequestException('Failed to create KPI category');
            }
        }
        // If user is DEPT_MANAGER -> create department-specific categories/objectives for manager's department only
        if (this.userHasRole(user, Role.DEPT_MANAGER)) {
            console.log('User has DEPT_MANAGER role:', user.id);
            // find manager's department
            const manager = await this.prisma.approver.findFirst({
                where: { userId: user.id, role: 'DEPT_MANAGER', isActive: true },
                include: { department: true }
            });

            if (!manager?.department) {
                throw new BadRequestException('Not authorized or no department assigned');
            }

            try {
                const created = await Promise.all(
                    categories.map(cat =>
                        this.prisma.kpiCategory.create({
                            data: {
                                name: cat.name,
                                type: KpiCategoryType.DEPARTMENTAL,
                                isGlobal: false,
                                department: { connect: { id: manager.department.id } },
                                objectives: cat.objectives && cat.objectives.length > 0 ? {
                                    create: cat.objectives.map(obj => ({
                                        name: obj.name,
                                        rating: null,
                                        comment: null,
                                    }))
                                } : undefined
                            }
                        })
                    )
                );
                return created;
            } catch (error) {
                if (error instanceof BadRequestException ||
                    error instanceof NotFoundException ||
                    error instanceof ConflictException) {
                    throw error;
                }
                throw new BadRequestException('Failed to create KPI categories:' + error.message);
            }
        }

        throw new BadRequestException('Unauthorized to create KPI categories');
    }

    async getCategories() {
        return this.prisma.kpiCategory.findMany({
            include: {
                objectives: true,
                department: {
                    select: {
                        id: true,
                        name: true
                    }
                }
            }
        });
    }

    async getGlobalCategories() {
        return this.prisma.kpiCategory.findMany({
            where: { isGlobal: true },
            include: { objectives: true }
        });
    }

    async updateCategory(userId: string, categoryId: string, data: CreateKpiDto) {
        const user = await this.findUserById(userId);
        if (!user) {
            throw bad('User Not Found');
        }
        const category = await this.prisma.kpiCategory.findUnique({
            where: { id: categoryId },
            include: {
                department: true,
                objectives: true
            }
        });

        if (!category) {
            throw new NotFoundException('Category not found');
        }

        // ADMIN can update any global category
        if (this.userHasRole(user, Role.ADMIN)) {
            if (!category.isGlobal) {
                throw new BadRequestException('Admins can only update global categories');
            }

            try {
                const { categories } = data;
                if (!categories?.[0]) {
                    throw new BadRequestException('Category data is required');
                }

                const cat = categories[0]; // Use first category from array
                return await this.prisma.kpiCategory.update({
                    where: { id: categoryId },
                    data: {
                        name: cat.name,
                        type: cat.type,
                        objectives: {
                            deleteMany: {}, // Remove existing objectives
                            create: cat.objectives?.map(obj => ({
                                name: obj.name,
                                rating: null,
                                comment: null
                            }))
                        }
                    },
                    include: { objectives: true }
                });
            } catch (error) {
                throw new BadRequestException('Failed to update category');
            }
        }

        // DEPT_MANAGER can only update their department's categories
        if (this.userHasRole(user, Role.DEPT_MANAGER)) {
            const manager = await this.prisma.approver.findFirst({
                where: {
                    userId: user.id,
                    role: 'DEPT_MANAGER',
                    isActive: true,
                    departmentId: category.departmentId
                }
            });

            if (!manager) {
                throw new BadRequestException('Not authorized to update this category');
            }

            try {
                const { categories } = data;
                if (!categories?.[0]) {
                    throw new BadRequestException('Category data is required');
                }

                const cat = categories[0];
                return await this.prisma.kpiCategory.update({
                    where: { id: categoryId },
                    data: {
                        name: cat.name,
                        type: KpiCategoryType.DEPARTMENTAL,
                        objectives: {
                            deleteMany: {}, // Remove existing objectives
                            create: cat.objectives?.map(obj => ({
                                name: obj.name,
                                rating: null,
                                comment: null
                            }))
                        }
                    },
                    include: { objectives: true }
                });
            } catch (error) {
                throw new BadRequestException('Failed to update department category');
            }
        }

        throw new BadRequestException('Unauthorized to update categories');
    }

    async removeCategory(userId: string, categoryId: string) {
        // Ensure we have a valid user object from DB
        const user = await this.findUserById(userId);
        if (!user) {
            throw bad('User Not Found');
        }
        const category = await this.prisma.kpiCategory.findUnique({
            where: { id: categoryId },
            include: { department: true },
        });

        if (!category) {
            throw new NotFoundException('Category not found');
        }
        if (!category) {
            throw new NotFoundException('Category not found');
        }

        // ===== ADMIN BLOCK =====
        if (this.userHasRole(user, Role.ADMIN)) {
            if (!category.isGlobal) {
                throw new BadRequestException('Admins can only delete global categories');
            }

            try {
                await this.prisma.kpiCategory.delete({
                    where: { id: categoryId },
                });
                return true;
            } catch (error) {
                console.error('DELETE ERROR:', error);
                throw new BadRequestException('Failed to delete category: ' + error.message);
            }
        }

        // ===== DEPT_MANAGER =====
        if (this.userHasRole(user, Role.DEPT_MANAGER)) {
            const manager = await this.prisma.approver.findFirst({
                where: {
                    userId: user.id,
                    role: 'DEPT_MANAGER',
                    isActive: true,
                    departmentId: category.departmentId,
                },
            });

            if (!manager) {
                throw new BadRequestException('Not authorized to delete this category');
            }

            try {
                await this.prisma.kpiCategory.delete({
                    where: { id: categoryId },
                });
                return true;
            } catch (error) {
                if (
                    error instanceof BadRequestException ||
                    error instanceof NotFoundException ||
                    error instanceof ConflictException
                ) {
                    throw error;
                }
                throw new BadRequestException('Failed to delete KPI Category: ' + error.message);
            }
        }

        // ===== UNAUTHORIZED USERS =====
        throw new BadRequestException('Unauthorized to delete categories');
    }

    async approveCategory(userId: string, categoryId: string) {
        const user = await this.findUserById(userId);
        if (!user) {
            throw bad('User Not Found');
        } else if (this.userHasRole(user, Role.ADMIN)) {
            try {
                return await this.prisma.kpiCategory.update({
                    where: { id: categoryId },
                    data: {
                        status: KpiCategoryStatus.APPROVED,
                        reviewedAt: new Date(),
                        reviewedBy: user.id,
                    },
                    include: {
                        department: {
                            include: {
                                approver: true,
                                appraisals: true,
                                // kpiCategories: true
                            }
                        }
                    }
                })
            } catch (error) {
                console.error('APPROVAL ERROR:', error);
                throw new BadRequestException('Failed to approve category: ' + error.message);
            }
        } else {
            throw bad('You are not authorized to perform this operation');
        }
    }

    async denyCategory(userId: string, categoryId: string) {
        const user = await this.findUserById(userId);
        if (!user) {
            throw bad('User Not Found');
        } else if (this.userHasRole(user, Role.ADMIN)) {
            try {
                return await this.prisma.kpiCategory.update({
                    where: { id: categoryId },
                    data: {
                        status: KpiCategoryStatus.REJECTED,
                        reviewedAt: new Date(),
                        reviewedBy: user.id,
                    },
                    include: {
                        department: {
                            include: {
                                approver: true,
                                appraisals: true,
                            }
                        }
                    }
                })
            } catch (error) {
                console.error('DENIAL ERROR:', error);
                throw new BadRequestException('Failed to deny category: ' + error.message);
            }
        }
    }


    //////////////////////////////// Helper Methods //////////////////////////
    private userHasRole(userObj: any, role: Role) {
        if (!userObj) return false;
        // userObj.userRole may be an array of Role or a single Role string
        const roles = (userObj.userRole ?? userObj.role) as any;
        if (Array.isArray(roles)) return roles.includes(role);
        return roles === role;
    }

    private async findUserById(userId: string) {
        const user = await this.prisma.user.findUnique({
            where: { id: userId },
        });
        return user;
    }
}
