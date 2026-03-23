import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { KpiCategoryStatus, KpiCategoryType, Role } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import { UserService } from 'src/user/user.service';
import { bad } from 'src/utils/error.utils';
import {
  CreateCompetencyDto
} from './dto/competency.dto';

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

    const isAuthorized =
      this.userHasRole(user, Role.ADMIN) ||
      this.userHasRole(user, Role.SUPERADMIN) ||
      this.userHasRole(user, Role.HR);

    if (!isAuthorized) {
      bad("You are not allowed to perform this action");
    }

    try {
      const results = await Promise.all(
        categories.map(async (cat) => {
          // ✅ include type in lookup
          const existing = await this.prisma.competencyCategory.findFirst({
            where: {
              name: cat.name,
            },
            include: { objectives: true },
          });

          // ✅ reuse if organizational
          if (existing && cat.type === KpiCategoryType.ORGANIZATIONAL) {
            return existing;
          }

          // ✅ create category
          const competencyCat = await this.prisma.competencyCategory.create({
            data: {
              name: cat.name,
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
            include: { objectives: true },
          });


          return {
            category: competencyCat,
          };
        })
      );

      return results;
    } catch (error) {
      console.error(error);
      throw new BadRequestException("Failed to create competency category");
    }
  }

  async getCategories() {
    return this.prisma.competencyCategory.findMany({

      include: {
        objectives: true,
      },
    });
  }

  async getGlobalCategories() {
    return this.prisma.competencyCategory.findMany({

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

        objectives: true,
      },
    });

    if (!category) {
      throw new NotFoundException('Category not found');
    }

    // Only ADMIN/SUPERADMIN/HR can update competency categories
    if (this.userHasRole(user, Role.ADMIN) || this.userHasRole(user, Role.SUPERADMIN) || this.userHasRole(user, Role.HR)) {


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
    });

    if (!category) {
      throw new NotFoundException('Category not found');
    }

    // Only ADMIN/SUPERADMIN/HR can delete competency categories
    if (this.userHasRole(user, Role.ADMIN) || this.userHasRole(user, Role.SUPERADMIN) || this.userHasRole(user, Role.HR)) {


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

  // async approveCategory(userId: string, categoryId: string) {
  //   const user = await this.findUserById(userId);
  //   if (!user) {
  //     throw bad('User Not Found');
  //   } else if (this.userHasRole(user, Role.ADMIN)) {
  //     try {
  //       return await this.prisma.competencyCategory.update({
  //         where: { id: categoryId },

  //       });
  //     } catch (error) {
  //       console.error('APPROVAL ERROR:', error);
  //       throw new BadRequestException(
  //         'Failed to approve category: ' + error.message,
  //       );
  //     }
  //   } else {
  //     throw bad('You are not authorized to perform this operation');
  //   }
  // }

  // async denyCategory(userId: string, categoryId: string) {
  //   const user = await this.findUserById(userId);
  //   if (!user) {
  //     throw bad('User Not Found');
  //   } else if (this.userHasRole(user, Role.ADMIN)) {
  //     try {
  //       return await this.prisma.competencyCategory.update({
  //         where: { id: categoryId },
  //         data: {
  //           status: KpiCategoryStatus.REJECTED,
  //           reviewedAt: new Date(),
  //           reviewedBy: user.id,
  //         },
  //         include: {
  //           department: {
  //             include: {
  //               approver: true,
  //               appraisals: true,
  //             },
  //           },
  //         },
  //       });
  //     } catch (error) {
  //       console.error('DENIAL ERROR:', error);
  //       throw new BadRequestException(
  //         'Failed to deny category: ' + error.message,
  //       );
  //     }
  //   }
  // }

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
