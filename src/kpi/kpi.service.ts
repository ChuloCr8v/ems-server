import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { KpiCategoryType, Role } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import { bad } from 'src/utils/error.utils';
import { CreateKpiTemplateDto } from './dto/kpi.dto';

@Injectable()
export class KpiService {
  constructor(private readonly prisma: PrismaService) { }

  async createCategory(userId: string, data: CreateKpiTemplateDto) {
    const user = await this.findUserById(userId);
    const { categories, department } = data;

    const isOrg = [Role.ADMIN, Role.SUPERADMIN].some((role) => user.userRole?.includes(role));

    const type = isOrg ? KpiCategoryType.ORGANIZATIONAL : KpiCategoryType.DEPARTMENTAL;

    return Promise.all(
      categories.map(async (category) => {
        await this.assertCategoryPermission(userId, type, department)

        return this.prisma.kpiTemplateCategory.create({
          data: {
            name: category.name.trim(),
            type: type,
            departmentId:
              type === KpiCategoryType.DEPARTMENTAL
                ? department
                : null,
            createdById: user.id,
            objectives: {
              create: (category.objectives ?? [])
                .filter((objective) => objective.name?.trim())
                .map((objective) => ({
                  name: objective.name.trim(),
                })),
            },
          },
          include: {
            objectives: true,
            department: true,
          },
        });
      }),
    );
  }

  async getCategories(userId: string, type?: KpiCategoryType) {
    const user = await this.findUserById(userId);
    const isAdmin = this.userHasAnyRole(user, [Role.ADMIN, Role.SUPERADMIN]);
    const isManager = this.userHasRole(user, Role.DEPT_MANAGER);

    if (isAdmin) {
      return this.prisma.kpiTemplateCategory.findMany({
        where: {
          ...(type ? { type } : {}),
        },
        include: {
          objectives: true,
          department: true,
        },
        orderBy: [{ type: 'asc' }, { name: 'asc' }],
      });
    }

    if (!isManager) {
      return this.prisma.kpiTemplateCategory.findMany({
        where: {
          type: KpiCategoryType.ORGANIZATIONAL,
          ...(type ? { type } : {}),
        },
        include: {
          objectives: true,
          department: true,
        },
        orderBy: [{ type: 'asc' }, { name: 'asc' }],
      });
    }

    const managedDepartmentIds = await this.getManagedDepartmentIds(userId);

    return this.prisma.kpiTemplateCategory.findMany({
      where: {
        ...(type ? { type } : {}),
        OR: [
          { type: KpiCategoryType.ORGANIZATIONAL },
          {
            type: KpiCategoryType.DEPARTMENTAL,
            departmentId: { in: managedDepartmentIds },
          },
        ],
      },
      include: {
        objectives: true,
        department: true,
      },
      orderBy: [{ type: 'asc' }, { name: 'asc' }],
    });
  }

  async updateCategory(userId: string, categoryId: string, data: CreateKpiTemplateDto) {
    const existing = await this.prisma.kpiTemplateCategory.findUnique({
      where: { id: categoryId },
      include: { objectives: true },
    });

    if (!existing) {
      throw new NotFoundException('KPI category not found');
    }

    const category = data.categories?.[0];
    if (!category) {
      throw new BadRequestException('Category data is required');
    }

    await this.assertExistingCategoryPermission(userId, existing.id);

    return this.prisma.kpiTemplateCategory.update({
      where: { id: categoryId },
      data: {
        name: category.name.trim(),
        objectives: {
          deleteMany: {},
          create: (category.objectives ?? [])
            .filter((objective) => objective.name?.trim())
            .map((objective) => ({
              name: objective.name.trim(),
            })),
        },
      },
      include: {
        objectives: true,
        department: true,
      },
    });
  }

  async removeCategory(userId: string, categoryId: string) {
    await this.assertExistingCategoryPermission(userId, categoryId);
    await this.prisma.kpiTemplateCategory.delete({
      where: { id: categoryId },
    });
    return true;
  }

  async getTemplatesForDepartment(departmentId: string) {
    return this.prisma.kpiTemplateCategory.findMany({
      where: {
        OR: [
          { type: KpiCategoryType.ORGANIZATIONAL },
          {
            type: KpiCategoryType.DEPARTMENTAL,
            departmentId,
          },
        ],
      },
      include: {
        objectives: true,
      },
      orderBy: [{ type: 'asc' }, { name: 'asc' }],
    });
  }

  private async assertExistingCategoryPermission(userId: string, categoryId: string) {
    const category = await this.prisma.kpiTemplateCategory.findUnique({
      where: { id: categoryId },
    });

    if (!category) {
      throw new NotFoundException('KPI category not found');
    }

    await this.assertCategoryPermission(userId, category.type, category.departmentId ?? undefined);
  }

  private async assertCategoryPermission(
    userId: string,
    type: KpiCategoryType,
    departmentId?: string,
  ) {
    const user = await this.findUserById(userId);
    const isAdmin = this.userHasAnyRole(user, [Role.ADMIN, Role.SUPERADMIN]);
    const isManager = this.userHasRole(user, Role.DEPT_MANAGER);

    if (type === KpiCategoryType.ORGANIZATIONAL) {
      if (!isAdmin) {
        throw bad('Only admins can manage organizational KPIs');
      }
      return;
    }

    if (type !== KpiCategoryType.DEPARTMENTAL) {
      throw bad('Unsupported KPI category type');
    }

    if (!departmentId) {
      throw new BadRequestException('departmentId is required for departmental KPIs');
    }

    if (!isManager) {
      throw bad('Only managers can manage departmental KPIs');
    }

    const managedDepartmentIds = await this.getManagedDepartmentIds(userId);
    if (!managedDepartmentIds.includes(departmentId)) {
      throw bad('You can only manage KPI templates for your department');
    }
  }

  private async getManagedDepartmentIds(userId: string) {
    const managedDepartments = await this.prisma.department.findMany({
      where: {
        approver: {
          some: {
            userId,
            role: Role.DEPT_MANAGER,
            isActive: true,
          },
        },
      },
      select: { id: true },
    });

    return managedDepartments.map((department) => department.id);
  }

  private userHasRole(user: { userRole: Role[] }, role: Role) {
    return user.userRole?.includes(role);
  }

  private userHasAnyRole(user: { userRole: Role[] }, roles: Role[]) {
    return roles.some((role) => this.userHasRole(user, role));
  }

  private async findUserById(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user;
  }
}
