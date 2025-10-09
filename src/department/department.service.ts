import {
    Injectable,
    InternalServerErrorException,
    NotFoundException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { DepartmentDto } from './dto/department.dto';
import { bad, mustHave } from 'src/utils/error.utils';
import { Role, User } from '@prisma/client';

@Injectable()
export class DepartmentService {
    constructor(private prisma: PrismaService) { }

    async createDepartment(input: DepartmentDto) {
        if (!input.createdBy) bad('Created By field is required', 400);

        const creator = await this.prisma.user.findUnique({
            where: { id: input.createdBy },
        });
        mustHave(creator, 'Creator Not Found', 404);

        let deptHead: User | null = null;
        if (input.departmentHead) {
            deptHead = await this.prisma.user.findUnique({
                where: { id: input.departmentHead },
            });
            mustHave(deptHead, 'Department Head Not Found', 404);
        }

        const existingDepartment = await this.prisma.department.findFirst({
            where: { name: input.name },
        });
        if (existingDepartment)
            bad('Department with this name already exists', 400);

        try {
            const department = await this.prisma.$transaction(async (prisma) => {
                const newDept = await prisma.department.create({
                    data: {
                        name: input.name,
                        createdBy: { connect: { id: input.createdBy } },
                    },
                });

                if (deptHead) {
                    await prisma.approver.deleteMany({
                        where: {
                            userId: deptHead.id,
                            departmentId: newDept.id,
                            role: Role.DEPT_MANAGER,
                        },
                    });

                    await prisma.approver.create({
                        data: {
                            userId: deptHead.id,
                            departmentId: newDept.id,
                            role: Role.DEPT_MANAGER,
                            isActive: true,
                        },
                    });

                    await prisma.user.update({   // ✅ use txn client, not this.prisma
                        where: { id: deptHead.id },
                        data: {
                            departments: {
                                connect: [{ id: newDept.id }],
                            },
                        },
                    });
                }

                return newDept;
            });


            return department;
        } catch (error: any) {
            console.log(error);
            throw new InternalServerErrorException(
                `Failed to create department: ${error.message}`,
            );
        }
    }

    async updateDepartment(id: string, update: Partial<DepartmentDto>) {
        const { name, departmentHead } = update;

        const department = await this.__findOneDepartment(id);
        if (!department) throw new NotFoundException('Department Not Found');

        try {
            const updatedDepartment = await this.prisma.$transaction(async (prisma) => {
                const newDept = await prisma.department.update({
                    where: { id },
                    data: {
                        name,
                    },
                });

                if (departmentHead) {
                    const deptHeadUser = await prisma.user.findUnique({
                        where: { id: departmentHead },
                        include: { departments: true },
                    });
                    if (!deptHeadUser)
                        throw new NotFoundException('Department Head User Not Found');

                    await prisma.approver.deleteMany({
                        where: { departmentId: newDept.id, role: Role.DEPT_MANAGER },
                    });

                    await prisma.approver.create({
                        data: {
                            userId: deptHeadUser.id,
                            departmentId: newDept.id,
                            role: Role.DEPT_MANAGER,
                            isActive: true,
                        },
                    });

                    const alreadyInDept = deptHeadUser.departments.some(
                        (d) => d.id === newDept.id,
                    );

                    if (!alreadyInDept) {
                        await prisma.user.update({
                            where: { id: departmentHead },
                            data: {
                                departments: {
                                    connect: [{ id: newDept.id }],
                                },
                            },
                        });
                    }
                }

                return newDept;
            });

            return updatedDepartment;
        } catch (error: any) {
            console.error(error);
            bad(`Failed to update department: ${error.message}`);
        }
    }


    async addTeamMembers(deptId: string, userIds: string[]) {
        if (!deptId) bad("Dept id must be provided");

        try {
            const dept = await this.__findOneDepartment(deptId);

            if (!dept) {
                mustHave(dept, `Department with id: ${deptId} not found!`);
            }

            for (const userId of userIds) {
                if (!userId) continue;

                const user = await this.prisma.user.findUnique({
                    where: {
                        id: userId
                    },
                    include: {
                        departments: true
                    }
                });

                if (user.departments.some(d => d.id === deptId)) return
                const updatedTeam = await this.prisma.user.update({
                    where: {
                        id: userId
                    },
                    data: {
                        departments: {
                            connect: {
                                id: deptId
                            }
                        }
                    }
                })

                return { message: "Team members added successfully", data: updatedTeam };

            }

        } catch (error: any) {
            console.error(error);
            bad(error);
        }
    }


    async getAllDepartment() {
        try {
            return await this.prisma.department.findMany({
                include: {
                    createdBy: true,
                    approver: {
                        include: {
                            user: true,
                        },
                    },
                    user: true,
                },
                orderBy: { createdAt: 'desc' },
            });
        } catch (error) {
            throw new InternalServerErrorException(
                `Failed to get all departments ${error.message}`,
            );
        }
    }

    async getTeam(userId: string) {
        try {
            const res = await this.prisma.department.findMany({
                where: {
                    user: {
                        some: { id: userId },
                    },
                },
                include: {
                    user: {
                        include: {
                            approver: {
                                include: {
                                    user: true,
                                },
                            },
                        },
                    },
                    approver: {
                        include: {
                            user: true,
                        },
                    },
                },
                orderBy: { createdAt: 'desc' },
            });

            mustHave(
                res.length > 0 ? res : null,
                'No teams found for this department',
                404,
            );

            const team = res.flatMap((x) => x.user);
            return team;
        } catch (error: any) {
            console.log(error);
            bad(`Failed to get teams: ${error.message}`);
        }
    }

    async getOneDepartment(id: string) {
        try {
            const department = await this.prisma.department.findUnique({
                where: { id },
                include: {
                    approver: true
                }
            });
            return department;
        } catch (error) {
            throw new InternalServerErrorException(
                `Failed to get department ${error.message}`,
            );
        }
    }

    async deleteDepartment(id: string) {
        try {
            const department = await this.__findOneDepartment(id);
            if (!department) {
                throw new NotFoundException('Department Not Found');
            }
            return await this.prisma.department.delete({
                where: { id },
            });
        } catch (error) {
            throw new InternalServerErrorException(
                `Failed to delete department ${error.message}`,
            );
        }
    }

    ///////////////////////// Helper Functions ////////////////////
    async __findOneDepartment(id: string) {
        return await this.prisma.department.findUnique({ where: { id } });
    }
}
