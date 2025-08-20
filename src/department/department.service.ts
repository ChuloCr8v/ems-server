import { Injectable, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { DepartmentDto } from './dto/department.dto';
import { bad, mustHave } from 'src/utils/error.utils';

@Injectable()
export class DepartmentService {
    constructor(private prisma: PrismaService) { }
    async createDepartment(input: DepartmentDto) {
        if (!input.createdBy) {
            bad("Created By field is required", 400);
        }

        const creator = await this.prisma.user.findUnique({
            where: { id: input.createdBy },
        });
        mustHave(creator, "Creator Not Found", 404);

        if (input.departmentHead) {
            const deptHead = await this.prisma.user.findUnique({
                where: { id: input.departmentHead },
            });
            mustHave(deptHead, "Department Head Not Found", 404);
        }

        try {
            const department = await this.prisma.department.create({
                data: {
                    name: input.name,
                    createdBy: { connect: { id: input.createdBy } },
                    ...(input.departmentHead && {
                        departmentHead: { connect: { id: input.departmentHead } },
                    }),
                },
            });

            if (input.departmentHead) {
                await this.prisma.user.update({
                    where: { id: input.departmentHead },
                    data: {
                        departmentHeadId: department.id,
                        departmentId: department.id,
                    },
                });
            }

            return department;
        } catch (error: any) {
            throw new InternalServerErrorException(
                `Failed to create department: ${error.message}`,
            );
        }
    }

    async getAllDepartment() {
        try {
            return await this.prisma.department.findMany({
                include: {
                    departmentHead: true,
                    createdBy: true,
                },
                orderBy: { createdAt: 'desc' },
            });
        } catch (error) {
            throw new InternalServerErrorException(`Failed to get all departments ${error.message}`);
        }
    }

    async getTeam(id: string) {
        try {
            const department = await this.prisma.user.findMany({
                where: { departmentId: id },
                include: {
                    department: true,
                },
                orderBy: { createdAt: 'desc' },
            });

            if (!department || department.length === 0) mustHave(department, "No teams found for this department", 404);
            return department;
        } catch (error) {
            bad(`Failed to get teams ${error.message}`);
        }
    }

    async getOneDepartment(id: string) {
        try {
            const department = await this.prisma.department.findUnique({
                where: { id },
            });
            return department;
        } catch (error) {
            throw new InternalServerErrorException(`Failed to get department ${error.message}`);
        }
    }

    async updateDepartment(id: string, update: DepartmentDto) {
        const { name } = update;
        try {
            const department = await this.__findOneDepartment(id);
            if (!department) {
                throw new NotFoundException("Department Not Found");
            };
            return await this.prisma.department.update({
                where: { id },
                data: { name }
            });
        } catch (error) {
            throw new InternalServerErrorException(`Failed to update department ${error.message}`);
        }
    }

    async deleteDepartment(id: string) {
        try {
            const department = await this.__findOneDepartment(id);
            if (!department) {
                throw new NotFoundException("Department Not Found");
            }
            return await this.prisma.department.delete({
                where: { id },
            });
        } catch (error) {
            throw new InternalServerErrorException(`Failed to delete department ${error.message}`);
        }
    }

    ///////////////////////// Helper Functions ////////////////////
    async __findOneDepartment(id: string) {
        return await this.prisma.department.findUnique({ where: { id } });
    }
}
