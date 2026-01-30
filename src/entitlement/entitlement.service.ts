import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { EntitlementDto, UpdateEntitlementDto } from './dto/entitlement.dto';
import { bad, mustHave } from 'src/utils/error.utils';
import { EntitlementType } from '@prisma/client';

@Injectable()
export class EntitlementService {
  constructor(private readonly prisma: PrismaService) {}

  async createEntitlement(dto: EntitlementDto) {
    const { name, unit } = dto;
    try {
      const entitlement = await this.prisma.entitlement.findUnique({
        where: { name },
      });
      if (entitlement) {
        throw bad('Entitlement already exist');
      }
      return await this.prisma.entitlement.create({
        data: {
          name,
          unit,
          type: dto.type,
          levels:
            dto.levels?.length > 0
              ? {
                  create: dto.levels?.map((level) => ({
                    levelId: level.levelId,
                    value: level.value,
                  })),
                }
              : undefined,
          departments:
            dto.departments?.length > 0
              ? {
                  create: dto.departments?.map((department) => ({
                    departmentId: department.departmentId,
                    value: department.value,
                  })),
                }
              : undefined,
        },
      });
    } catch (error) {
      bad(error);
    }
  }

  async getEntitlements() {
    try {
      return await this.prisma.entitlement.findMany({
        orderBy: {
          createdAt: 'desc',
        },
        include: {
          levels: {
            include: {
              level: true,
            },
          },
          departments: {
            include: {
              department: true,
            },
          },
        },
      });
    } catch (error) {
      bad(error);
    }
  }

  async getEntitlement(id: string) {
    try {
      return await this.__findEntitlementById(id);
    } catch (error) {
      bad(error);
    }
  }

  async getEmployeeLeaveEntitlement(id: string, context: 'CLAIMS' | 'LEAVE') {
    const isLeave = context === 'LEAVE';
    try {
      const employee = await this.prisma.user.findUnique({
        where: { id },
        include: {
          level: {
            include: {
              entitlements: {
                include: { entitlement: true },
              },
            },
          },
          departments: {
            include: {
              entitlements: {
                include: { entitlement: true },
              },
            },
          },
        },
      });
      if (!employee) mustHave(employee, 'Account not found', 404);

      const leaveEntitlements = employee.level?.entitlements.filter(
        (e) =>
          e.entitlement.type === (isLeave ? 'LEAVE' : 'CLAIMS') ||
          e.entitlement.unit === 'AMOUNT',
      );

      const isMale = employee.gender?.trim().toLowerCase().startsWith('m');

      const finalReturn = isMale
        ? leaveEntitlements.filter(
            (e) => !e.entitlement.name.toLowerCase().includes('maternity'),
          )
        : leaveEntitlements;

      return finalReturn;
    } catch (error) {
      bad(error);
    }
  }

  async updateEntitlement(id: string, dto: UpdateEntitlementDto) {
    const { name, unit, levels, departments, scope } = dto;
    try {
      await this.__findEntitlementById(id);
      const update = await this.prisma.entitlement.update({
        where: { id },
        data: {
          name,
          unit,
          scope,
          levels: levels
            ? {
                deleteMany: {},
                create: levels?.map((level) => ({
                  levelId: level.levelId,
                  value: level.value,
                })),
              }
            : undefined,
          departments: departments
            ? {
                deleteMany: {},
                create: departments?.map((department) => ({
                  departmentId: department.departmentId,
                  value: department.value,
                })),
              }
            : undefined,
        },
      });
      return update;
    } catch (error) {
      bad(error);
    }
  }

  async deleteEntitlement(id: string) {
    try {
      await this.__findEntitlementById(id);
      const entitlement = await this.prisma.entitlement.delete({
        where: { id },
      });
      return entitlement;
    } catch (error) {
      bad(error);
    }
  }

  /////////////////////////////////// HELPER FUNCTION //////////////////////////////
  async __findEntitlementById(id: string) {
    const entitlement = await this.prisma.entitlement.findUnique({
      where: { id },
      include: {
        levels: {
          include: {
            level: true,
          },
        },
        departments: {
          include: {
            department: true,
          },
        },
      },
    });
    if (!entitlement) {
      throw bad('Entitlement Not Found');
    }
    return entitlement;
  }
}
