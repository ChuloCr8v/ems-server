import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { KpiCategoryStatus, KpiCategoryType, Role } from '@prisma/client';
import {
  CreateCompetencyCategoryDto,
  CreateCompetencyDto,
  CreateCompetencyObjectiveDto,
} from './dto/competency.dto';
import { UserService } from 'src/user/user.service';
import { bad } from 'src/utils/error.utils';

@Injectable()
export class CompetencyService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly userService: UserService,
  ) { }

  // Admin Methods - Global KPIs
  async createCategory(userId: string, data: CreateCompetencyDto) {
    const user = await this.findUserById(userId);
    const { categories } = data;
    // Only ADMIN/SUPERADMIN/HR can create global competency categories
    if (this.userHasRole(user, Role.ADMIN) || this.userHasRole(user, Role.SUPERADMIN) || this.userHasRole(user, Role.HR)) {
      try {
        const createdOrExisting = await Promise.all(
          categories.map(async (cat) => {
            // Check if competency category already exists by name and type
            const existing = await this.prisma.competencyCategory.findFirst({
              where: {
                name: cat.name,
                type: cat.type,
                isGlobal: true,
              },
              include: { objectives: true },
            });

            // If ORGANIZATIONAL and exists, reuse it
            if (existing && cat.type === KpiCategoryType.ORGANIZATIONAL) {
              return existing;
            }

            // Otherwise, create new organizational competency category
            return await this.prisma.competencyCategory.create({
              data: {
                name: cat.name,
                type: cat.type ?? KpiCategoryType.ORGANIZATIONAL,
                isGlobal: true,
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
          }),
        );

        return createdOrExisting;
      } catch (error) {
        console.error(error);
        throw new BadRequestException('Failed to create competency category');
      }
    }
    // // If user is DEPT_MANAGER -> create department-specific categories/objectives for manager's department only
    // if (this.userHasRole(user, Role.DEPT_MANAGER)) {
    //   console.log('User has DEPT_MANAGER role:', user.id);
    //   // find manager's department
    //   const manager = await this.prisma.approver.findFirst({
    //     where: { userId: user.id, role: 'DEPT_MANAGER', isActive: true },
    //     include: { department: true },
    //   });

    //   if (!manager?.department) {
    //     throw new BadRequestException(
    //       'Not authorized or no department assigned',
    //     );
    //   }

    //   try {
    //     const created = await Promise.all(
    //       categories.map((cat) =>
    //         this.prisma.kpiCategory.create({
    //           data: {
    //             name: cat.name,
    //             type: KpiCategoryType.DEPARTMENTAL,
    //             isGlobal: false,
    //             department: { connect: { id: manager.department.id } },
    //             objectives:
    //               cat.objectives && cat.objectives.length > 0
    //                 ? {
    //                     create: cat.objectives.map((obj) => ({
    //                       name: obj.name,
    //                       rating: null,
    //                       comment: null,
    //                     })),
    //                   }
    //                 : undefined,
    //           },
    //         }),
    //       ),
    //     );
    //     return created;
    //   } catch (error) {
    //     if (
    //       error instanceof BadRequestException ||
    //       error instanceof NotFoundException ||
    //       error instanceof ConflictException
    //     ) {
    //       throw error;
    //     }
    //     throw new BadRequestException(
    //       'Failed to create KPI categories:' + error.message,
    //     );
    //   }
    // }

    throw new BadRequestException('Unauthorized to create KPI categories');
  }

  async getCategories() {
    return this.prisma.competencyCategory.findMany({
      where: { isGlobal: true },
      include: {
        objectives: true,
      },
    });
  }

  async getGlobalCategories() {
    return this.prisma.competencyCategory.findMany({
      where: { isGlobal: true },
      include: { objectives: true },
    });
  }

  async updateCategory(userId: string, categoryId: string, data: CreateCompetencyDto) {
    const user = await this.findUserById(userId);
    if (!user) {
      throw bad('User Not Found');
    }
    const category = await this.prisma.competencyCategory.findUnique({
      where: { id: categoryId },
      include: {
        department: true,
        objectives: true,
      },
    });

    if (!category) {
      throw new NotFoundException('Category not found');
    }

    // Only ADMIN/SUPERADMIN/HR can update competency categories
    if (this.userHasRole(user, Role.ADMIN) || this.userHasRole(user, Role.SUPERADMIN) || this.userHasRole(user, Role.HR)) {
      if (!category.isGlobal) {
        throw new BadRequestException(
          'Only global competency categories can be updated',
        );
      }

      try {
        const { categories } = data;
        if (!categories?.[0]) {
          throw new BadRequestException('Category data is required');
        }

        const cat = categories[0];
        return await this.prisma.competencyCategory.update({
          where: { id: categoryId },
          data: {
            name: cat.name,
            type: cat.type ?? KpiCategoryType.ORGANIZATIONAL,
            isGlobal: true,
            objectives: {
              deleteMany: {},
              create: cat.objectives?.map((obj) => ({
                name: obj.name,
                rating: null,
                comment: null,
              })) ?? [],
            },
          },
          include: { objectives: true },
        });
      } catch (error) {
        throw new BadRequestException('Failed to update competency category');
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
    const category = await this.prisma.competencyCategory.findUnique({
      where: { id: categoryId },
      include: { department: true },
    });

    if (!category) {
      throw new NotFoundException('Category not found');
    }

    // Only ADMIN/SUPERADMIN/HR can delete competency categories
    if (this.userHasRole(user, Role.ADMIN) || this.userHasRole(user, Role.SUPERADMIN) || this.userHasRole(user, Role.HR)) {
      if (!category.isGlobal) {
        throw new BadRequestException(
          'Only global competency categories can be deleted',
        );
      }

      try {
        await this.prisma.competencyCategory.delete({
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
        console.error('DELETE ERROR:', error);
        throw new BadRequestException(
          'Failed to delete competency category: ' + error.message,
        );
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
        return await this.prisma.competencyCategory.update({
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
              },
            },
          },
        });
      } catch (error) {
        console.error('APPROVAL ERROR:', error);
        throw new BadRequestException(
          'Failed to approve category: ' + error.message,
        );
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
        return await this.prisma.competencyCategory.update({
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
              },
            },
          },
        });
      } catch (error) {
        console.error('DENIAL ERROR:', error);
        throw new BadRequestException(
          'Failed to deny category: ' + error.message,
        );
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
