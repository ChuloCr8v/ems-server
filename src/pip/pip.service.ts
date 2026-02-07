import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { ApprovePipDto, CreatePipDto, MarkPipAsCompletedDto, RecommendPipDto, RejectPipDto } from './dto/pip.dto';
import { bad } from 'src/utils/error.utils';
import { DepartmentService } from 'src/department/department.service';
import { Role } from '@prisma/client';

import { EventEmitter2 } from '@nestjs/event-emitter';
import { PipApprovedEvent, PipCompletedEvent, PipRecommendedEvent, PipRejectedEvent } from 'src/events/pip.event';

@Injectable()
export class PipService {
    constructor(
        private readonly prisma: PrismaService,
        private eventEmitter: EventEmitter2
    ) { }

    async createPip(userId: string, data: CreatePipDto) {
        try {
            const user = await this.findUserById(userId);
            if (!user) {
                throw bad("User Not Found")
            }
            const { title, platform, url, startDate, endDate, duration, cost, reason } = data;
            if(data.rPipId) {
                const rPip = await this.prisma.recommendedPip.findUnique({
                    where: { id: data.rPipId },
                    include: { pip: true } 
                });
                if(!rPip) {
                    throw bad("Recommended PIP Not Found");
                }
                if(rPip.recommendedForId !== user.id) {
                    throw bad("This Recommended PIP was not assigned to you");
                }
                if(rPip.pip) {
                    throw bad ("A PIP has already been created for this Recommended PIP");
                }
            }
            return await this.prisma.pip.create({
                data: {
                    pipId: `Pip${this.generateShortId(4)}`,
                    title,
                    platform,
                    url,
                    startDate,
                    endDate,
                    duration,
                    cost,
                    reason,
                    user: {
                        connect: { id: user.id },
                    },
                    rPip: data.rPipId
                    ? {
                        connect: { id: data.rPipId },
                    }
                    : undefined,
                    uploads: data.uploads
                        ? {
                            connect: data.uploads.map((id) => ({ id })),
                        }
                        : undefined,
                },
            });
        } catch (error) {
            console.log(error);
            bad(`Failed to create pip: ${error.message}`);
        }
    }

    async getMyPips(userId: string) {
        try {
            const user = await this.findUserById(userId);
            if (!user) {
                throw bad("User Not Found")
            }
        
            const isHR = this.userHasRole(user, Role.HR);
            const isManager = this.userHasRole(user, Role.DEPT_MANAGER);
            if(isHR) {
                return await this.prisma.pip.findMany({
                    include: {
                        rPip: true,
                        comment: true,
                        uploads: true,
                        user: true,
                    }
                });
            }
             //Users: Can only see their own pips
            if(!isManager) {
                return await this.prisma.pip.findMany({
                    where: { userId: user.id },
                    include: {
                        rPip: true,
                        comment: true,
                        uploads: true,
                        user: true,
                    }
                });
            }
            // DEPT_MANAGERS: can see pips for the users in their team along with theirs
            const department = await this.prisma.department.findFirst({
                where: {
                    user: {
                        some: { id: user.id },
                    },
                },
                include: {
                    user: true,
                    teams: {
                        include: {
                            members: true,
                        },
                    },
                },
            });
            if (!department) {
                throw bad("Department Not Found")
            }
            const memberIds = department.user.map(user => user.id)
            // const memberIds = department.teams.flatMap(team => team.members.map(member => member.id));
            return await this.prisma.pip.findMany({
                where: {
                    OR: [
                        //Pip for manager
                        { userId: user.id },

                        //Pip for team members
                        { userId: { in: memberIds } },
                    ],
                },
                include: {
                    rPip: true,
                    comment: true,
                    uploads: true,
                    user: true,
                },
            });
        } catch (error) {
            console.log(error);
            bad(`Failed to get pips: ${error.message}`);
        }
    }

    async getPipById(pipId: string) {
        try {
            return await this.prisma.pip.findUnique({
                where: { id: pipId },
                include: {
                    rPip: {
                        include: {
                            recommendedBy: true,
                            recommendedFor: true,
                            comment: true,
                            uploads: true,
                        }
                    }
                }
            });
        } catch (error) {
            console.log(error);
            bad(`Failed to get pip: ${error.message}`);
        }
    }

    async updatePip(pipId: string, data: Partial<CreatePipDto>) {
        try {
            const pip = await this.getPipById(pipId);
            if(!pip) {
                throw bad("PIP Not Found");
            }
            if(pip.status !== 'PENDING') {
                throw bad("Cannot update PIP that is already in progress");
            }
            const { title, platform, url, startDate, endDate, duration, cost, reason } = data;
            return await this.prisma.pip.update({
                where: { id: pip.id },
                data: {
                    title,
                    platform,
                    url,
                    startDate,
                    endDate,
                    duration,
                    cost,
                    reason,
                    rPip: data.rPipId
                    ? {
                        connect: { id: data.rPipId },
                    }
                    : undefined,
                     uploads: data.uploads
                        ? {
                            connect: data.uploads.map((id) => ({ id })),
                        }
                        : undefined,
                }
            })
        } catch (error) {
            console.log(error);
            bad(`Failed to update pip: ${error.message}`);
        }
    }

    async getAllPips(userId: string) {
        try {
            const user = await this.findUserById(userId);
            if(!user) {
                throw bad("User Not Found");
            }
            const isHR = this.userHasRole(user, Role.HR);
            const isAdmin = this.userHasRole(user, Role.ADMIN);
            if(!isHR && !isAdmin) {
                throw bad("Unauthorized to view the following pips");
            }
            return await this.prisma.pip.findMany({
                include: {
                    rPip: true,
                    comment: true,
                    uploads: true,
                    user: true,
                }
            })
        } catch (error) {
            console.log(error);
            bad(`Failed to get pips: ${error.message}`);
        }
    }

    async recommendPip(userId: string, data: RecommendPipDto) {
        try {
            const { aoi, comment, teamMemberId } = data;
            const user = await this.findUserById(userId);
            if (!user) {
                throw bad("User Not Found")
            }

            const isHR = this.userHasRole(user, Role.HR);
            const isManager = this.userHasRole(user, Role.DEPT_MANAGER);
            let targetUser;

            if (!isHR && !isManager) {
                throw bad("Only HR and Department Managers can recommend PIPs");
            }

            //HR: can recommend for any user
            if (isHR) {
                targetUser = await this.findUserById(teamMemberId);
                if (!targetUser) {
                    throw bad("Selected user not found");
                }
            }
            //DEPT_MANGERS: can only recommend for users in their department
            else {
                const department = await this.prisma.department.findFirst({
                    where: {
                        user: {
                            some: { id: user.id },
                        },
                    },
                    include: {
                        user: true,
                        teams: {
                            include: {
                                members: true,
                            },
                        },
                    },
                });
                if (!department) {
                    throw bad("Department Not Found")
                }
                // const members = department.teams.flatMap(team => team.members);
                targetUser = department.user.find((member) => member.id === teamMemberId);

                if (!targetUser) {
                    throw bad("Selected user is not in your department");
                }
            }

            //Create recommended PIP
            const recommendedPip = await this.prisma.recommendedPip.create({
                data: {
                    aoi,
                    rPipId: `Rpip${this.generateShortId(4)}`,
                    recommendedBy: {
                        connect: { id: user.id }
                    },
                    recommendedFor: {
                        connect: { id: targetUser.id },
                    },
                    comment: {
                        create: {
                            comment,
                        },
                    },
                    uploads: data.uploads
                        ? {
                            connect: data.uploads.map((id) => ({ id })),
                        }
                        : undefined,
                },
            });

            this.eventEmitter.emit(
                'pip.recommended',
                new PipRecommendedEvent(
                    recommendedPip.id,
                    user.id,
                    targetUser.id,
                    [targetUser.id]
                )
            );

            return recommendedPip;
        } catch (error) {
            console.log(error);
            bad(`Failed to recommend pip: ${error.message}`);
        }
    }

    async getAllRecommendedPips(userId: string) {
        try {
            const user = await this.findUserById(userId);
            if (!user) {
                throw bad("User Not Found")
            }
            
            const isHR = this.userHasRole(user, Role.HR);
            const isManager = this.userHasRole(user, Role.DEPT_MANAGER);

            // HR: can see all recommended pips
            if (isHR) {
                return await this.prisma.recommendedPip.findMany({
                    include: {
                        recommendedBy: true,
                        recommendedFor: true,
                        comment: true,
                        uploads: true
                    },
                });
            }
            //Users: can only see their own recommended pips
            if (!isManager) {
                return await this.prisma.recommendedPip.findMany({
                    where: { recommendedForId: user.id },
                    include: {
                        recommendedBy: true,
                        comment: true,
                        uploads: true
                    },
                })
            }

            // DEPT_MANAGERS: can see recommended pips for users in their department
            const department = await this.prisma.department.findFirst({
                where: {
                    user: {
                        some: { id: user.id },
                    },
                },
                include: {
                    user: true,
                    teams: {
                        include: {
                            members: true,
                        },
                    },
                },
            });
            if (!department) {
                throw bad("Department Not Found")
            }
            const memberIds = department.teams.flatMap(team => team.members.map(member => member.id));

            return this.prisma.recommendedPip.findMany({
                where: {
                    OR: [
                        //Pips recommended by manager
                        { recommendedById: user.id },

                        //Pips recommended to manager
                        { recommendedForId: user.id },

                        //Pips recommended for department members
                        // { recommendedForId: { in: memberIds } },
                    ],
                },
                include: {
                    recommendedBy: true,
                    recommendedFor: true,
                    comment: true,
                    uploads: true
                }
            })
        } catch (error) {
            console.log(error);
            bad(`Failed to get recommended pips: ${error.message}`);
        }
    }

    async approvePip(userId: string, pipId: string, data: ApprovePipDto) {
        try {
        const user = await this.findUserById(userId);
        if (!user) throw bad("User Not Found")
        
        const pip = await this.getPipById(pipId);
        if (!pip) throw bad("PIP Not Found")

        const isManager = this.userHasRole(user, Role.DEPT_MANAGER);

        //Manager approval: only for users in their department
        if (isManager || pip.status !== 'PENDING') {
            throw bad("Unauthorized to approve this PIP")
        }
        const approvedPip = await this.prisma.pip.update({
                where: { id: pip.id },
                data: {
                    status: 'APPROVED',
                    comment: {
                        create: {
                            comment: data.comment
                        },
                    },
                    uploads: data.uploads
                        ? {
                            connect: data.uploads.map((id) => ({ id })),
                        }
                        : undefined,
                },
            });

            this.eventEmitter.emit(
                'pip.ManagerApproved',
                new PipApprovedEvent(
                    approvedPip.id,
                    user.id,
                    pip.userId,
                    [pip.userId]
                )
            );

            return approvedPip;
        } catch (error) {
            console.log(error);
            bad(`Failed to approve pip: ${error.message}`);
        }
    }

    async approveDepartmentsPip(userId: string, departmentId: string) {
        try {
            const user = await this.findUserById(userId);
            if(!user) {
                throw bad("User Not Found");
            }
            const isHR = this.userHasRole(user, Role.HR)
            if(!isHR) throw bad("Only HR can approve departmental pips");
            
            const department = await this.prisma.department.findUnique({
                where: {
                    id: departmentId
                },
                include: {
                    user: true,
                    teams: {
                        include: {
                            members: true,
                        },
                    },
                },
            });
            if(!department) {
                throw bad("Department Not Found");
            }
            if(department.pipStatus !== 'PENDING') {
                throw bad("Department PIPs already reviewed");
            }
            //Get all departments user IDs
            const memeberIds = department.user.map(user => user.id);
            if(memeberIds.length === 0) {
                throw bad("No Users Found In The Department");
            }

            //Fetch all manager-approved PIPs
            const pips = await this.prisma.pip.findMany({
                where: {
                    userId: { in: memeberIds },
                    status: 'APPROVED',
                },
            });
            if(pips.length === 0){
                throw bad("No PIPs pending HR approval for deparments");
            }
            const totalCost = pips.reduce(
                (sum, pip) => sum + (pip.cost ?? 0),
                0
            )
            await this.prisma.department.update({
                where: { id: department.id },
                data: { pipStatus: 'APPROVED'}
            });

            //Notify Users
            pips.forEach(pip => {
                this.eventEmitter.emit(
                    'pip.HR-Approved',
                    new PipApprovedEvent(
                        pip.id,
                        user.id,
                        pip.userId,
                        [pip.userId]
                    )
                );
            });

            return { approvedPips: pips.length, totalCost };
        } catch (error) {
            console.log(error);
            bad(`Failed to approve departmental pip: ${error.message}`);
        }
    }

    async rejectPip(userId: string, pipId: string, data: RejectPipDto) {
        const user = await this.findUserById(userId);
        if (!user) throw bad("User Not Found");

        const pip = await this.getPipById(pipId);
        if (!pip) throw bad("PIP Not Found");

        const userRoles = user.userRole || [];
        const isManager = userRoles.includes(Role.DEPT_MANAGER);

        if (isManager || pip.status !== 'PENDING') {
            throw bad("You are unauthorized to reject this PIP at this stage");
        }

        if (!isManager) {
            throw bad("Unauthorized to reject this PIP");
        }

        const { rejectedPip, rPip } = await this.prisma.$transaction(async tx => {
            //Reject PIP
            const rejectedPip = await tx.pip.update({
                where: { id: pip.id },
                data: {
                    status: 'REJECTED',
                    rejectedById: user.id,
                    rejecteAt: new Date(),
                    comment: {
                        create: { comment: data.reason, userId: user.id },
                    },
                    uploads: data.uploads
                        ? {
                            connect: data.uploads.map((id) => ({ id })),
                        }
                        : undefined,
                },
                // select: { rejectedById: true, rejecteAt: true, user: true, id: true },
            });
            //Create new recommended PIP
            const rPip = await tx.recommendedPip.create({
                data: {
                    rPipId: `RPIP${this.generateShortId(4)}`,
                    aoi: data.aoi,
                    reason: data.reason,
                    recommendedBy: {
                        connect: { id: user.id },
                    },
                    recommendedFor: {
                        connect: { id: pip.userId },
                    },
                    uploads: data.uploads
                        ? {
                            connect: data.uploads.map((id) => ({ id })),
                        }
                        : undefined,
                },
            });
            return { rejectedPip, rPip };
        });

        this.eventEmitter.emit(
            'pip.rejected',
            new PipRejectedEvent(
                rejectedPip.id,
                user.id,
                rejectedPip.userId,
                [rejectedPip.userId]
            )
        );

        this.eventEmitter.emit(
            'pip.recommended',
            new PipRecommendedEvent(
                rPip.id,
                user.id,
                rPip.recommendedForId,
                [rPip.recommendedForId]
            )
        );

        return rPip;
    }

    async rejectDepartmentPip(userId: string, departmentId: string) {
        try {
            const user = await this.findUserById(userId);
            if(!user) throw bad("User Not Found");
            const isHR = this.userHasRole(user, Role.HR);
            if(!isHR) throw bad("Only HR can reject departmental PIPs");

            const department = await this.prisma.department.findUnique({
                where: { id: departmentId },
                include: {
                    user: true,
                    teams: {
                        include: { members: true },
                    },
                },
            });
            if(!department) throw bad("Department Not Found");
            if(department.pipStatus !== 'PENDING') {
                throw bad("Department PIPs already reviewed");
            }

            //Get all departments user IDs
            const memeberIds = department.user.map(user => user.id);
            if(memeberIds.length === 0) {
                throw bad("No Users Found In The Department");
            }

            //Fetch all manager-approved PIPs
            const pips = await this.prisma.pip.findMany({
                where: {
                    userId: { in: memeberIds },
                    status: 'APPROVED',
                },
            });
            if(pips.length === 0){
                throw bad("No PIPs pending HR approval for deparments")
            }
            const totalCost = pips.reduce(
                (sum, pip) => sum + (pip.cost ?? 0),
                0
            )
            await this.prisma.department.update({
                where: { id: department.id },
                data: { pipStatus: 'REJECTED' }
            });

            //Notify Users
            pips.forEach(pip => {
                this.eventEmitter.emit(
                    'pip.HR-Rejected',
                    new PipRejectedEvent(
                        pip.id,
                        user.id,
                        pip.userId,
                        [pip.userId]
                    )
                );
            });
            return { rejectedPips: pips.length, totalCost }
        } catch (error) {
            console.log(error);
            bad(`Failed to reject departmental pip: ${error.message}`);
        }
    }

    async markPipAsCompleted(userId: string, pipId: string, data: MarkPipAsCompletedDto) {
        const user = await this.findUserById(userId);
        if (!user) {
            throw bad("User Not Found");
        }
        const pip = await this.getPipById(pipId);
        if (!pip) {
            throw bad("PIP Not Found")
        }
        if (pip.userId !== user.id) {
            throw bad("You can only mark your own PIP as completed");
        }
        const updatedPip = await this.prisma.pip.update({
            where: { id: pip.id },
            data: {
                status: 'COMPLETED',
                comment: {
                    create: {
                        comment: data.comment,
                    },
                },
                uploads: data.uploads
                    ? {
                        connect: data.uploads.map((id) => ({ id })),
                    }
                    : undefined,
            },
        });

        // Notify the recommender (Manager) that PIP is completed
        const recipientIds = pip.rPip?.recommendedById ? [pip.rPip.recommendedById] : [];

        this.eventEmitter.emit(
            'pip.completed',
            new PipCompletedEvent(
                updatedPip.id,
                user.id,
                recipientIds
            )
        );

        return updatedPip;
    }


    /////////////////////////////// Helpers ///////////////////////////////
    private async findUserById(userId: string) {
        try {
            const user = await this.prisma.user.findUnique({
                where: { id: userId },
                include: { team: { include: { department: true } } },
            });
            return user;
        } catch (error) {
            console.log(error);
            bad(`Failed to get user: ${error.message}`);
        }
    }

    private userHasRole(userObj: any, role: Role) {
            if (!userObj) return false;
            // userObj.userRole may be an array of Role or a single Role string
            const roles = (userObj.userRole ?? userObj.role) as any;
            if (Array.isArray(roles)) return roles.includes(role);
            return roles === role;
        }

    private async findDepartmentById(departmentId: string) {
        try {
            const department = await this.prisma.department.findUnique({
                where: { id: departmentId },
                include: {
                    user: true,
                },
            });

            if (!department) {
                throw bad("Department not found");
            }
            return department;

        } catch (error) {
            console.log(error);
            bad(`Failed to get department: ${error.message}`);
        }
    }

    private generateShortId(length: number = 10) {
        const chars = '0123456789';
        let result = '';
        for (let i = 0; i < length; i++) {
            result += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return result;
    }
}
