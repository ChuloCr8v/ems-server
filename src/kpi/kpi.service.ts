import { Injectable, BadRequestException, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { KpiCategoryType, Role } from '@prisma/client';
import { CreateKpiCategoryDto, CreateKpiDto, CreateKpiObjectiveDto } from './dto/kpi.dto';
import { UserService } from 'src/user/user.service';

@Injectable()
export class KpiService {
    constructor(private readonly prisma: PrismaService, private readonly userService: UserService) {}

    // Admin Methods - Global KPIs
    async createCategory(userId: string, data: CreateKpiDto) {
        // normalize user: if caller passed id string, fetch from db

        const user = await this.userService.getMe(userId);
        let dbUser = user;
        if (typeof user === 'string') {
            dbUser = await this.prisma.user.findUnique({ where: { id: user }, include: { approver: true } });
        } else if (user && !user.userRole && user.id) {
            dbUser = await this.prisma.user.findUnique({ where: { id: user.id }, include: { approver: true } });
        }

        const { categories } = data;

        // If user is ADMIN -> create global categories/objectives
        if (this.userHasRole(dbUser, Role.ADMIN)) {
            try {
                const created = await Promise.all(
                    categories.map(cat =>
                        this.prisma.kpiCategory.create({
                            data: {
                                name: cat.name,
                                type: cat.type,
                                isGlobal: cat.isGlobal ?? true,
                                isApproved: true,
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
                throw new BadRequestException('Failed to create KPI category');
            }
        }

        // If user is DEPT_MANAGER -> create department-specific categories/objectives for manager's department only
        if (this.userHasRole(dbUser, Role.DEPT_MANAGER)) {
            console.log('User has DEPT_MANAGER role:', dbUser.id);
            // find manager's department
            const manager = await this.prisma.approver.findFirst({
                where: { userId: dbUser.id, role: 'DEPT_MANAGER', isActive: true },
                include: { department: true }
            });

            if (!manager?.department) {
                throw new BadRequestException('Not authorized or no department assigned');
            }

            //         if (!manager?.department) {
            //     // Log more details for debugging
            //     const allManagers = await this.prisma.approver.findMany({
            //         where: { userId: dbUser.id },
            //         include: { department: true }
            //     });
            //     console.log('All approver records for user:', allManagers);
                
            //     throw new BadRequestException('Not authorized or no department assigned');
            // }

            try {
                const created = await Promise.all(
                    categories.map(cat =>
                        this.prisma.kpiCategory.create({
                            data: {
                                name: cat.name,
                                type: KpiCategoryType.DYNAMIC,
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
                                throw new BadRequestException('Failed to create KPI categories:' + error.message);;
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

    async updateCategory(user: any, categoryId: string, data: CreateKpiDto) {
        let dbUser = user;
        if (typeof user === 'string') {
            dbUser = await this.prisma.user.findUnique({ where: { id: user } });
        } else if (user && !user.userRole && user.id) {
            dbUser = await this.prisma.user.findUnique({ where: { id: user.id } });
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
        if (this.userHasRole(dbUser, Role.ADMIN)) {
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
        if (this.userHasRole(dbUser, Role.DEPT_MANAGER)) {
            const manager = await this.prisma.approver.findFirst({
                where: { 
                    userId: dbUser.id,
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
                        type: KpiCategoryType.DYNAMIC,
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

    async removeCategory(user: any, categoryId: string) {
        let dbUser = user;
        if (typeof user === 'string') {
            dbUser = await this.prisma.user.findUnique({ where: { id: user } });
        } else if (user && !user.userRole && user.id) {
            dbUser = await this.prisma.user.findUnique({ where: { id: user.id } });
        }
        const category = await this.prisma.kpiCategory.findUnique({
            where: { id: categoryId },
            include: { department: true }
        });

        if (!category) {
            throw new NotFoundException('Category not found');
        }

        // ADMIN can delete any global category
        if (this.userHasRole(dbUser, Role.ADMIN)) {
            if (!category.isGlobal) {
                throw new BadRequestException('Admins can only delete global categories');
            }

            try {
                await this.prisma.kpiCategory.delete({
                    where: { id: categoryId }
                });
                return true;
            } catch (error) {
                throw new BadRequestException('Failed to delete category');
            }
        }

        // DEPT_MANAGER can only delete their department's categories
        if (this.userHasRole(dbUser, Role.DEPT_MANAGER)) {
            const manager = await this.prisma.approver.findFirst({
                where: { 
                    userId: dbUser.id,
                    role: 'DEPT_MANAGER',
                    isActive: true,
                    departmentId: category.departmentId
                }
            });

            if (!manager) {
                throw new BadRequestException('Not authorized to delete this category');
            }

            try {
                await this.prisma.kpiCategory.delete({
                    where: { id: categoryId }
                });
                return true;
            } catch (error) {
                throw new BadRequestException('Failed to delete department category');
            }
        }

        throw new BadRequestException('Unauthorized to delete categories');
    }

    //////////////////////////////// Helper Methods //////////////////////////
    private userHasRole(userObj: any, role: Role) {
        if (!userObj) return false;
        // userObj.userRole may be an array of Role or a single Role string
        const roles = (userObj.userRole ?? userObj.role) as any;
        if (Array.isArray(roles)) return roles.includes(role);
        return roles === role;
    }
}
