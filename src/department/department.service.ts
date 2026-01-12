import {
    Injectable,
    InternalServerErrorException,
    NotFoundException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { DepartmentDto } from './dto/department.dto';
import { bad, mustHave } from 'src/utils/error.utils';
import { Prisma, Role, User } from '@prisma/client';

type Tx = Prisma.TransactionClient;


@Injectable()
export class DepartmentService {
    constructor(private prisma: PrismaService) { }

    async createDepartment(input: DepartmentDto) {
        if (!input.createdBy) bad('Created By field is required', 400);

        const creator = await this.prisma.user.findUnique({
            where: { id: input.createdBy },
        });
        mustHave(creator, 'Creator Not Found', 404);

        if (
            input.departmentHead &&
            input.teamLead &&
            input.departmentHead === input.teamLead
        ) {
            bad('Department Head and Team Lead cannot be the same user', 400);
        }

        if (input.departmentHead) {
            const deptHead = await this.prisma.user.findUnique({
                where: { id: input.departmentHead },
            });
            mustHave(deptHead, 'Department Head Not Found', 404);
        }

        if (input.teamLead) {
            const teamLead = await this.prisma.user.findUnique({
                where: { id: input.teamLead },
            });
            mustHave(teamLead, 'Team Lead Not Found', 404);
        }

        const existingDepartment = await this.prisma.department.findFirst({
            where: { name: input.name },
        });
        if (existingDepartment) {
            bad('Department with this name already exists', 400);
        }

        try {
            const department = await this.prisma.$transaction(async (prisma) => {
                const newDept = await prisma.department.create({
                    data: {
                        name: input.name,
                        createdBy: { connect: { id: input.createdBy } },
                    },
                });

                if (input.departmentHead) {
                    await this.assignDepartmentRole(prisma, {
                        userId: input.departmentHead,
                        departmentId: newDept.id,
                        role: Role.DEPT_MANAGER,
                        notFoundMessage: 'Department Head Not Found',
                    });
                }

                if (input.teamLead) {
                    await this.assignDepartmentRole(prisma, {
                        userId: input.teamLead,
                        departmentId: newDept.id,
                        role: Role.TEAM_LEAD,
                        notFoundMessage: 'Team Lead Not Found',
                    });
                }

                return newDept;
            });

            return department;
        } catch (error: any) {
            console.error(error);
            throw new InternalServerErrorException(
                `Failed to create department: ${error.message}`,
            );
        }
    }

    async updateDepartment(id: string, update: Partial<DepartmentDto>) {
        const { name, departmentHead, teamLead } = update;

        const department = await this.__findOneDepartment(id);
        if (!department) throw new NotFoundException('Department Not Found');

        if (departmentHead && teamLead && departmentHead === teamLead) {
            bad('Department Head and Team Lead cannot be the same user', 400);
        }

        try {
            const updatedDepartment = await this.prisma.$transaction(async (prisma) => {
                const newDept = await prisma.department.update({
                    where: { id },
                    data: {
                        ...(typeof name === 'string' ? { name } : {}),
                    },
                });

                if (departmentHead) {
                    const oldHead = department.approver.find(a => a.role === Role.DEPT_MANAGER).user.id;
                    const newHead = departmentHead;

                    await this.assignDepartmentRole(prisma, {
                        userId: newHead,
                        departmentId: newDept.id,
                        role: Role.DEPT_MANAGER,
                        notFoundMessage: 'Department Manager Not Found',
                    });

                    if (oldHead && oldHead !== newHead) {
                        await prisma.approver.deleteMany({
                            where: {
                                userId: oldHead,
                                departmentId: newDept.id,
                                role: Role.DEPT_MANAGER,
                            },
                        });

                        await this.cleanupUserRole(prisma, oldHead, Role.DEPT_MANAGER);
                    }
                }

                if (teamLead) {
                    const oldLead = department.approver.find(a => a.role === Role.TEAM_LEAD)?.user.id;;
                    const newLead = teamLead;

                    await this.assignDepartmentRole(prisma, {
                        userId: newLead,
                        departmentId: newDept.id,
                        role: Role.TEAM_LEAD,
                        notFoundMessage: 'Team Lead Not Found',
                    });

                    if (oldLead && oldLead !== newLead) {
                        await prisma.approver.deleteMany({
                            where: {
                                userId: oldLead,
                                departmentId: newDept.id,
                                role: Role.TEAM_LEAD,
                            },
                        });

                        await this.cleanupUserRole(prisma, oldLead, Role.TEAM_LEAD);
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
            mustHave(dept, `Department with id: ${deptId} not found!`);

            // Filter out falsy IDs before mapping
            const validIds = userIds.filter(Boolean);

            // Process all users in parallel
            const results = await Promise.all(
                validIds.map(async (userId) => {
                    try {
                        const user = await this.prisma.user.findUnique({
                            where: { id: userId },
                            include: { departments: true },
                        });

                        if (!user) {
                            return { userId, status: "skipped", reason: "User not found" };
                        }

                        if (user.departments.some((d) => d.id === deptId)) {
                            return { userId, status: "skipped", reason: "Already in department" };
                        }

                        const updated = await this.prisma.user.update({
                            where: { id: userId },
                            data: {
                                departments: { connect: { id: deptId } },
                            },
                        });

                        return { userId, status: "added", data: updated };
                    } catch (err: any) {
                        console.error(`Error updating user ${userId}:`, err);
                        return { userId, status: "failed", reason: err.message };
                    }
                })
            );

            const added = results.filter((r) => r.status === "added");
            const skipped = results.filter((r) => r.status === "skipped");
            const failed = results.filter((r) => r.status === "failed");

            return {
                message: "Team member update completed",
                summary: {
                    added: added.length,
                    skipped: skipped.length,
                    failed: failed.length,
                },
                data: {
                    added,
                    skipped,
                    failed,
                },
            };
        } catch (error: any) {
            console.error("Bulk addTeamMembers error:", error);
            bad(error);
        }
    }

    async removeTeamMembers(deptId: string, userIds: string[]) {
        if (!deptId) bad("Dept id must be provided");

        try {
            const dept = await this.__findOneDepartment(deptId);
            mustHave(dept, `Department with id: ${deptId} not found!`);

            const validIds = userIds.filter(Boolean);

            const results = await Promise.all(
                validIds.map(async (userId) => {
                    try {
                        const user = await this.prisma.user.findUnique({
                            where: { id: userId },
                            include: { departments: true },
                        });

                        if (!user) {
                            return { userId, status: "skipped", reason: "User not found" };
                        }

                        if (!user.departments.some((d) => d.id === deptId)) {
                            return { userId, status: "skipped", reason: "Not in department" };
                        }

                        const updated = await this.prisma.user.update({
                            where: { id: userId },
                            data: {
                                departments: { disconnect: { id: deptId } },
                            },
                        });

                        return { userId, status: "removed", data: updated };
                    } catch (err: any) {
                        console.error(`Error removing user ${userId}:`, err);
                        return { userId, status: "failed", reason: err.message };
                    }
                })
            );

            const removed = results.filter((r) => r.status === "removed");
            const skipped = results.filter((r) => r.status === "skipped");
            const failed = results.filter((r) => r.status === "failed");

            return {
                message: "Team member removal completed",
                summary: {
                    removed: removed.length,
                    skipped: skipped.length,
                    failed: failed.length,
                },
                data: {
                    removed,
                    skipped,
                    failed,
                },
            };
        } catch (error: any) {
            console.error("Bulk removeTeamMembers error:", error);
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
        return await this.prisma.department.findUnique({
            where: { id },
            include: {
                approver:
                {
                    include: {
                        user: true,
                    }
                },
            },
        });
    }


    async assignDepartmentRole(
        prisma: Tx,
        params: {
            userId: string;
            departmentId: string;
            role: Role;
            notFoundMessage: string;
        },
    ) {
        const { userId, departmentId, role, notFoundMessage } = params;

        const user = await prisma.user.findUnique({
            where: { id: userId },
            include: { departments: true },
        });

        if (!user) {
            throw new NotFoundException(notFoundMessage);
        }

        // Remove any existing approver entries for this dept/role (idempotent)
        await prisma.approver.deleteMany({
            where: { departmentId, role },
        });

        // Create new approver entry
        await prisma.approver.create({
            data: {
                userId,
                departmentId,
                role,
                isActive: true,
            },
        });

        const existingRoles = user.userRole ?? [];
        const hasRole = existingRoles.includes(role);
        const newRoles = hasRole ? existingRoles : [...existingRoles, role];

        const alreadyInDept = user.departments.some((d) => d.id === departmentId);

        await prisma.user.update({
            where: { id: userId },
            data: {
                userRole: {
                    set: newRoles,
                },
                ...(alreadyInDept
                    ? {}
                    : {
                        departments: {
                            connect: [{ id: departmentId }],
                        },
                    }),
            },
        });
    }

    private async cleanupUserRole(
        tx: Prisma.TransactionClient,
        userId: string,
        role: Role
    ) {
        const stillHasApproval = await tx.approver.findFirst({
            where: {
                userId,
                role,
            },
        });

        if (stillHasApproval) return;

        const user = await tx.user.findUnique({
            where: { id: userId },
        });

        const existingRoles = user?.userRole ?? [];
        const newRoles = existingRoles.filter((r) => r !== role);

        await tx.user.update({
            where: { id: userId },
            data: {
                userRole: {
                    set: newRoles,
                },
            },
        });
    }

}
