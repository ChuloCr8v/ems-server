import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import {
  ApprovePipDto,
  CreatePipDto,
  MarkPipAsCompletedDto,
  RecommendPipDto,
  RejectPipDto,
} from './dto/pip.dto';
import { bad } from 'src/utils/error.utils';
import { ClaimType, Role } from '@prisma/client';

import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  PipApprovedEvent,
  PipCompletedEvent,
  PipRecommendedEvent,
  PipRejectedEvent,
} from 'src/events/pip.event';
import { CreateClaimDto } from 'src/claims/dto/claims.dto';

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
            if(data.rPId) {
                const rPip = await this.prisma.recommendedPip.findUnique({
                    where: { id: data.rPId },
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
               if (data.uploads && data.uploads.length > 0) {
                const existingUploads = await this.prisma.upload.findMany({
                    where: { id: { in: data.uploads } },
                    select: { id: true },
                });
                const existingIds = existingUploads.map((u) => u.id);
                const missing = data.uploads.filter((id) => !existingIds.includes(id));
                if (missing.length) {
                    throw bad(`Uploads not found: ${missing.join(', ')}`);
                }
            }
            return await this.prisma.pip.create({
                data: {
                    pId: `TP${this.generateShortId(4)}`,
                    title,
                    platform,
                    url,
                    startDate,
                    endDate,
                    duration,
                    cost,
                    department: {
                        connect: { id: user.departments[0].id },
                    },
                    reason,
                    user: {
                        connect: { id: user.id },
                    },
                    rP: data.rPId
                    ? {
                        connect: { id: data.rPId },
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
                        rP: true,
                        comment: true,
                        uploads: true,
                        user: true,
                        department: {
                            include: {
                                approver: {
                                    include: { user: true, }
                                },
                            }
                        }
                    }
                });
            }
             //Users: Can only see their own pips
            if(!isManager) {
                return await this.prisma.pip.findMany({
                    where: { userId: user.id },
                    include: {
                        rP: true,
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
          rP: true,
          comment: true,
          uploads: true,
          user: true,
          department: {
            include: { approver: true, }
          },
        },
      });
    } catch (error) {
      console.log(error);
      bad(`Failed to get pips: ${error.message}`);
    }
  }

    async getPipById(pipId: string) {
        try {
            if (!pipId || typeof pipId !== 'string' || pipId === 'undefined') {
                throw bad('Invalid pip id');
            }

            const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

            const includeOpts = {
                rP: {
                    include: {
                        recommendedBy: true,
                        recommendedFor: true,
                        comment: true,
                        uploads: true,
                    },
                },
                department: true,
                comment: true,
                uploads: true,
            };

            if (uuidRegex.test(pipId)) {
                return await this.prisma.pip.findUnique({
                    where: { id: pipId },
                    include: includeOpts,
                });
            }

            return await this.prisma.pip.findFirst({
                where: { pId: pipId },
                include: includeOpts,
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
                    rP: data.rPId
                    ? {
                        connect: { id: data.rPId },
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
                    rP: true,
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
        throw bad('User Not Found');
      }

            const isHR = this.userHasRole(user, Role.HR);
            const isManager = this.userHasRole(user, Role.DEPT_MANAGER);
            let targetUser;

      if (!isHR && !isManager) {
        throw bad('Only HR and Department Managers can recommend PIPs');
      }

      //HR: can recommend for any user
      if (isHR) {
        targetUser = await this.findUserById(teamMemberId);
        if (!targetUser) {
          throw bad('Selected user not found');
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
          throw bad('Department Not Found');
        }

        targetUser = department.user.find((member) => member.id === teamMemberId);

        if (!targetUser) {
          throw bad('Selected user is not in your department');
        }
      }

            //Create recommended PIP
            const recommendedPip = await this.prisma.recommendedPip.create({
                data: {
                    aoi,
                    rPipId: `RTP${this.generateShortId(4)}`,
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
        new PipRecommendedEvent(recommendedPip.id, user.id, targetUser.id, [
          targetUser.id,
        ]),
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
            uploads: true,
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
            uploads: true,
          },
        });
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
            // const memberIds = department.teams.flatMap(team => team.members.map(member => member.id));

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
        if (!pip) throw bad("PIP Not Found");
    
        if (pip.status !== 'PENDING') {
            throw bad("PIP already reviewed");
        }

         //Check for pip owner
        const pipOwner = await this.findUserById(pip.userId);
        if (!pipOwner) throw bad("PIP Owner Not Found");

        const approverIsManager = this.userHasRole(user, Role.DEPT_MANAGER);
        const approverIsSuperAdmin = this.userHasRole(user, Role.SUPERADMIN);

        //Check if pip owner is a manager
        const ownerIsManager = this.userHasRole(pipOwner, Role.DEPT_MANAGER);

        /**
         * RULE 1:
         * If PIP owner is a Manager → ONLY SuperAdmin can approve
         */
        if(ownerIsManager) {
            if(!approverIsSuperAdmin) {
                throw bad("Only Super Admin Can Approve A Manager's PIP");
            }
            const approvedPip = await this.prisma.pip.update({
                where: { id: pip.id },
                data: {
                    status: 'MANAGER_APPROVED',
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
        }

         /**
         * RULE 2:
         * If PIP owner is a regular employee → Only Department Manager can approve
         */
        if(!ownerIsManager) {
            if(!approverIsManager) {
                throw bad("Only Department Manager Can Approve This PIP");
            }
            const approvedPip = await this.prisma.pip.update({
                where: { id: pip.id },
                data: {
                    status: 'MANAGER_APPROVED',
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
        }

        } catch (error) {
            console.log(error);
            bad(`Failed to approve pip: ${error.message}`);
        }
    }

    async sendToHr(userId: string, departmentId: string) {
        try {
            const user = await this.findUserById(userId);
            if (!user) throw bad("User Not Found");

            const isManager = this.userHasRole(user, Role.DEPT_MANAGER);
            if(!isManager) throw bad("Only department manager can send PIPs to HR");

            const department = await this.prisma.department.findUnique({
                    where: {
                        id: departmentId
                    },
                    include: {
                        user: true,
                        approver: true,
                        teams: {
                            include: {
                                members: true,
                            },
                        },
                    },
                });
            const department_Manager = department.approver.find(approver => approver.userId === user.id && approver.role === 'DEPT_MANAGER');
            if(!department_Manager) throw bad("You are not the manager of this department");

            //Fetch Manager Appproved PIPs
            const pips = await this.prisma.pip.findMany({
                where: { 
                    departmentId, 
                    status: 'MANAGER_APPROVED'
                },
            });
            if(pips.length === 0) throw bad ("No manager approved PIP to send");
            console.log(pips.length)

            //Calculate total cost
            const totalCost = pips.reduce(
                (sum, pip) => sum + (pip.cost || 0),
                0
            );

            //Update department status
            await this.prisma.department.update({
                where: { id: departmentId },
                data: { pipStatus: 'SUBMITTED' },
            })

            //Update PIP status
            await this.prisma.pip.updateMany({
                where: {
                    departmentId,
                    status: 'MANAGER_APPROVED',
                },
                data: {
                    status: 'SUBMITTED'
                },
            });
            
            return {
                departmentId,
                totalCost,
                manager: user.id
            }
        } catch (error) {
            console.log(error);
            bad(`Failed to send pip to HR: ${error.message}`);
        }
    }

    async approveDepartmentsPip(userId: string, departmentId: string, reason?: string) {
        try {
            const user = await this.findUserById(userId);
            if (!user) throw bad("User Not Found");

            if (!this.userHasRole(user, Role.HR)) {
            throw bad("Only HR can approve departmental PIPs");
            }

            const department = await this.prisma.department.findUnique({
            where: { id: departmentId },
            });

            if (!department) {
            throw bad("Department Not Found");
            }

            if (department.pipStatus !== 'SUBMITTED') {
            throw bad("Department PIPs are not awaiting HR approval");
            }

            const pips = await this.prisma.pip.findMany({
            where: {
                departmentId,
                status: 'SUBMITTED',
            },
            });

            if (pips.length === 0) {
            throw bad("No PIPs pending HR approval for this department");
            }

            const totalCost = pips.reduce(
            (sum, pip) => sum + (pip.cost ?? 0),
            0
            );

            //Create immutable HR approval record
            await this.prisma.hrDepartmentApproval.create({
            data: {
                departmentId,
                approvedById: user.id,
                totalCost,
                status: 'HR_APPROVED',
                reason: reason
                    ? {
                        create: {
                            comment: reason,
                            userId: user.id,
                        }
                    }
                    : undefined,
            },
            });

            //Approve all PIPs
            await this.prisma.pip.updateMany({
            where: { id: { in: pips.map(p => p.id) } },
            data: { status: 'HR_APPROVED' },
            });

            //Update department
            await this.prisma.department.update({
            where: { id: departmentId },
            data: { pipStatus: 'HR_APPROVED' },
            });

            //Notify users
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

            return {
            departmentId,
            approvedPips: pips.length,
            totalCost,
            };
        } catch (error) {
            console.log(error);
            bad(`Failed to approve departmental PIPs: ${error.message}`);
        }
        }


    async rejectPip(userId: string, pipId: string, data: RejectPipDto) {
        const user = await this.findUserById(userId);
        if (!user) throw bad("User Not Found");

        const pip = await this.getPipById(pipId);
        if (!pip) throw bad("PIP Not Found");

        if(pip.status !== 'PENDING') throw bad("PIP is already reviewed");

        //Check for Pip Owner
        const isPipOwner = await this.findUserById(pip.userId);
        if (!isPipOwner) throw bad("PIP Owner Not Found");

        const approverIsManager = this.userHasRole(user, Role.DEPT_MANAGER);
        const approverIsSuperAdmin = this.userHasRole(user, Role.SUPERADMIN);

        //Check if PIP Owner is a manager
        const ownerIsManager = this.userHasRole(isPipOwner, Role.DEPT_MANAGER);

        /**
         * RULE 1:
         * If PIP owner is a Manager → ONLY SuperAdmin can approve
         */
        if(ownerIsManager) {
            if(!approverIsSuperAdmin) {
                throw bad("Only SuperAdmin can reject a PIP owned by a Manager");
            }

             const { rejectedPip, rPip } = await this.prisma.$transaction(async (tx) => {
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
             new PipRejectedEvent(rejectedPip.id, user.id, rejectedPip.userId, [
                rejectedPip.userId,
              ]),
            );

            this.eventEmitter.emit(
            'pip.recommended',
            new PipRecommendedEvent(rPip.id, user.id, rPip.recommendedForId, [
                rPip.recommendedForId,
            ]),
            );
           return rPip;
        }

        /**
         * RULE 2:
         * If PIP owner is a regular employee → Only Department Manager can approve
         */
        if(!ownerIsManager){
            if(!approverIsManager) {
                throw bad("Only Department Manager Can Reject This PIP");
            }
            const { rejectedPip, rPip } = await this.prisma.$transaction(async (tx) => {
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
            new PipRejectedEvent(rejectedPip.id, user.id, rejectedPip.userId, [
                rejectedPip.userId,
              ]),
            );

            this.eventEmitter.emit(
            'pip.recommended',
            new PipRecommendedEvent(rPip.id, user.id, rPip.recommendedForId, [
                rPip.recommendedForId,
              ]),
            );

           return rPip;
        }
    }

    async rejectDepartmentPip(userId: string, departmentId: string, reason: string) {
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
            if(department.pipStatus !== 'SUBMITTED') {
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
                    status: 'SUBMITTED',
                },
            });
            if(pips.length === 0){
                throw bad("No PIPs pending HR approval for deparments")
            }
            const totalCost = pips.reduce(
                (sum, pip) => sum + (pip.cost ?? 0),
                0
            )
            // Create immutable HR rejection record
            await this.prisma.hrDepartmentApproval.create({
                data: {
                    departmentId,
                    approvedById: user.id,
                    totalCost,
                    status: 'REJECTED',
                    reason: {
                        create: {
                            comment: reason,
                            userId: user.id
                        }
                    }
                },
            });

            // Reject all PIPs for the department
            await this.prisma.pip.updateMany({
                where: { id: { in: pips.map(p => p.id) } },
                data: { status: 'REJECTED' },
            });

            // Update department status
            await this.prisma.department.update({
                where: { id: department.id },
                data: { pipStatus: 'REJECTED' }
            });

            // Notify Users
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

            return { rejectedPips: pips.length, totalCost };
        } catch (error) {
            console.log(error);
            bad(`Failed to reject departmental pip: ${error.message}`);
        }
    }

    async getAllManagersPip(userId: string){
        try {
            const user = await this.findUserById(userId);
            if(!user) throw bad("User Not Found");
            const isSuperAdmin = this.userHasRole(user, Role.SUPERADMIN);
            if(!isSuperAdmin) throw bad("Only Super Admin can view all managers PIPs");
            const managerPips = await this.prisma.pip.findMany({
                where: { user: { role: 'DEPT_MANAGER' } },
                include: { 
                    rP: true, 
                    comment: true, 
                    uploads: true, 
                    user: true, 
                    department: true,
                }
            })
            return managerPips;
        } catch (error) {
            console.log(error);
            bad(`Failed to ge all manager's pip: ${error.message}`);
        }
    }

    async deleteAllPips(userId: string) {
        try {
            const user = await this.findUserById(userId);
            if(!user) throw bad("User Not Found");
            const isSuperAdmin = this.userHasRole(user, Role.SUPERADMIN);
            if(!isSuperAdmin) throw bad("Only Super Admin can delete all PIPs");
            await this.prisma.pip.deleteMany({});
        } catch (error) {
          console.log(error);
            bad(`Failed to delete all PIPs: ${error.message}`);  
        }
    }

    async markPipAsCompleted(
        userId: string,
        pipId: string,
        data: MarkPipAsCompletedDto,
    ) {
        try {
          const user = await this.findUserById(userId);
            if (!user) {
            throw bad('User Not Found');
            }
          const pip = await this.getPipById(pipId);
            if (!pip) {
            throw bad('PIP Not Found');
            }

            if (pip.userId !== user.id) {
            throw bad('You can only mark your own PIP as completed');
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
            const recipientIds = pip.rP?.recommendedById
            ? [pip.rP.recommendedById]
            : [];

            this.eventEmitter.emit(
            'pip.completed',
            new PipCompletedEvent(updatedPip.id, user.id, recipientIds),
            );

            if(updatedPip) {
                const claim = await this.makePipClaimRequest(pipId, userId);
                return { updatedPip, claim };
              } else {
              throw bad("Failed to make PIP claim request");
            }
         } catch (error) {
            console.log(error);
            bad(`Failed to mark PIP as completed: ${error.message}`);
         }
     }

    /////////////////////////////// Helpers ///////////////////////////////
    private async findUserById(userId: string) {
        try {
            const user = await this.prisma.user.findUnique({
                where: { id: userId },
                include: { departments: true, approver: true, },
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

    private generateShortId(length: number = 10) {
        const chars = '0123456789';
        let result = '';
        for (let i = 0; i < length; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return result;
    }

    private async makePipClaimRequest(pipId: string, userId: string) {
            try {
                const user = await this.findUserById(userId);
                if(!user) throw bad("User Not Found");

                const pip = await this.getPipById(pipId);
                if(!pip) throw bad("Pip Not Found");

                if(pip.userId !== user.id) throw bad("You can only make claim request for your own PIP");
                if(pip.status !== 'COMPLETED') throw bad("Only completed PIPs are eligible for claim requests");

                const claimId = 'CLM' + Date.now().toString().slice(-4);
                 //Create claim request
                 const claim = await this.prisma.claim.create({
                    data: {
                        claimId,
                        title: pip.title,
                        amount: pip.cost,
                        dateOfExpense: pip.endDate,
                        description: pip.reason,
                        type: ClaimType.TRAINING_PLAN,
                        user: {
                            connect: { id: user.id }
                        },
                        pip: {
                            connect: { id: pip.id },
                        },
                        proofUrls: pip.uploads && pip.uploads.length > 0
                        ? {
                            connect: pip.uploads.map((upload) => ({ id: upload.id })),
                        }
                        : undefined,
                    },
                    include: {
                        user: true,
                        pip: true,
                    },
                 });
                 return claim;
                 

            } catch (error) {
                console.log(error);
                bad(`Failed to make pip claim request: ${error.message}`);
            }
        }

}
