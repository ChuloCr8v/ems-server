import { Injectable } from '@nestjs/common';
import { Report, Task, UserTask, TaskStatus, Prisma, User, ReportStatus } from '@prisma/client';

import { PrismaService } from 'src/prisma/prisma.service';
import { bad, mustHave } from 'src/utils/error.utils';
import { CreateDepartmentWeeklyReportDto } from './dto/report.dto';
import { randomBytes } from 'crypto';

@Injectable()
export class ReportService {
  constructor(private readonly prisma: PrismaService) { }


  async createReport(body: CreateDepartmentWeeklyReportDto, userId: string) {
    try {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        include: { departments: true },
      });
      if (!user) mustHave(user, 'User not found', 404);
      if (!user.userRole.includes('DEPT_MANAGER'))
        bad('User not authorized', 401);

      const { title, department, week, reports, isDraft } = body;
      const departmentField = department ?? (user.defaultId ? user.defaultId : user.departments[0].id);

      const existingReport = await this.prisma.departmentWeeklyReport.findFirst({
        where: {
          week,
          departmentId: departmentField
        },
        include: {
          reports: true
        }
      });

      if (existingReport && existingReport.status === ReportStatus.SUBMITTED
      ) bad(`Report for week ${week} has been submitted already`)
      if (existingReport && existingReport.status !== ReportStatus.SUBMITTED) {
        // Delete existing sub-reports
        await this.prisma.reportItem.deleteMany({
          where: {
            weeklyReportId: existingReport.id
          }
        });

        // Update the main report
        const updatedReport = await this.prisma.departmentWeeklyReport.update({
          where: {
            id: existingReport.id
          },
          data: {
            title,
            status: isDraft ? ReportStatus.DRAFT : ReportStatus.SUBMITTED,
            reports: {
              create: reports.map((r) => ({
                title: r.title,
                description: r.description,
                status: r.status,
                deliveryDate: r?.deliveryDate ? new Date(r.deliveryDate) : null,
                includeAssignees: r.includeAssignees,
                task: r?.taskId ? { connect: { id: r.taskId } } : undefined,
                attachments: r.attachments?.length ? { connect: r.attachments.map((id) => ({ id })) } : undefined,
                comment: r.comment
              })),
            },
          },
          include: {
            reports: {
              include: {
                task: {
                  include: {
                    taskTransfers: {
                      include: {
                        user: true
                      }
                    },
                    createdBy: true
                  }
                },
              },
            },
            department: true,
          },
        });

        return {
          message: 'Report Updated Successfully',
          data: updatedReport,
        };
      }

      // Create new report if none exists
      const reportId =
        'RPT-' +
        new Date().getFullYear() +
        '-W' +
        week +
        '-' +
        randomBytes(3).toString('hex').toUpperCase();

      const report = await this.prisma.departmentWeeklyReport.create({
        data: {
          title,
          week,
          reportId,
          status: isDraft ? ReportStatus.DRAFT : ReportStatus.SUBMITTED,
          department: {
            connect: {
              id: departmentField
            },
          },
          reports: {
            create: reports.map((r) => ({
              title: r.title,
              description: r.description,
              status: r.status,
              deliveryDate: r?.deliveryDate ? new Date(r.deliveryDate) : null,
              includeAssignees: r.includeAssignees,
              task: r?.taskId ? { connect: { id: r.taskId } } : undefined,
              attachments: r.attachments?.length ? { connect: r.attachments.map((id) => ({ id })) } : undefined,
              comment: r.comment
            })),
          },
        },
        include: {
          reports: {
            include: {
              task: true,
            },
          },
          department: true,
        },
      });

      return {
        message: 'Report Created Successfully',
        data: report,
      };
    } catch (error) {
      console.error('Error creating report:', error);
      bad(error);
    }
  }

  async generateWeeklyReports() {
    try {
      const week = getCurrentWeek();

      const users = await this.prisma.user.findMany({
        include: {
          userTask: { include: { task: true } },
          createdTasks: true,
        },
      });

      const reports = [];

      for (const user of users) {
        const taskIds = [
          ...user.userTask.flatMap((t) => t.task),
          ...user.createdTasks,
        ]
          .filter((item: Task) => {
            return (
              item.status !== TaskStatus.COMPLETED ||
              (item.status === TaskStatus.COMPLETED && !item.isReported)
            );
          })
          .map((item: Task) => item.id)
          .filter(Boolean);

        let existing = await this.prisma.report.findFirst({
          where: { week, userId: user.id },
          include: {
            tasks: true,
            user: true,
          },
        });

        if (existing) {
          if (taskIds.length > 0) {
            await this.prisma.$transaction(async (tx) => {
              await tx.report.update({
                where: { id: existing.id },
                data: {
                  tasks: {
                    connect: taskIds.map((id) => ({ id })),
                  },
                },
              });

              await tx.task.updateMany({
                where: {
                  id: { in: taskIds },
                  status: TaskStatus.COMPLETED,
                },
                data: { isReported: true },
              });
            });

            existing = await this.prisma.report.findFirst({
              where: { id: existing.id },
              include: { tasks: true, user: true },
            });
          }

          reports.push(existing);
          continue;
        }

        const newReport = await this.prisma.$transaction(async (tx) => {
          const report = await tx.report.create({
            data: {
              week,
              title: `Weekly Report - Week ${week}`,
              user: { connect: { id: user.id } },
              tasks: {
                connect:
                  taskIds.length > 0 ? taskIds.map((id) => ({ id })) : [],
              },
            },
            include: {
              tasks: true,
              user: true,
            },
          });

          if (taskIds.length > 0) {
            await tx.task.updateMany({
              where: {
                id: { in: taskIds },
                status: TaskStatus.COMPLETED,
              },
              data: { isReported: true },
            });
          }

          return report;
        });

        reports.push(newReport);
      }

      return reports;
    } catch (error) {
      console.error('Error generating weekly reports:', error);
      bad(error);
    }
  }

  async listWeeklyReports(userId: string) {
    try {
      const [user, reports] = await Promise.all([
        this.prisma.user.findUnique({ where: { id: userId } }),
        this.prisma.report.findMany({
          include: {
            tasks: {
              include: {
                department: true,
                category: true,
                assignees: { include: { user: true } },
                taskIssues: true,
                createdBy: true,
                taskTransfers: {
                  include: {
                    user: true
                  }
                }
              },
            },
            user: {
              include: {
                departments: true
              }
            },
          },
          orderBy: { createdAt: 'desc' },
        }),
      ]);

      if (!user) bad('User not found');

      const accessibleReports = await this.filterReportsByRole(user, reports);

      const weeklyData = this.groupByWeekAndDepartment(accessibleReports);

      return {
        message: 'Report Returned Successfully',
        totalWeeks: weeklyData.length,
        data: weeklyData,
      };
    } catch (error) {
      bad(error);
    }
  }

  private async filterReportsByRole(user: User, reports: Report[]) {
    if (user.userRole.includes('ADMIN') || user.userRole.includes('SUPERADMIN')) {
      return reports;
    }

    if (user.userRole.includes('DEPT_MANAGER')) {
      const departments = await this.prisma.department.findMany({
        where: { approver: { some: { userId: user.id } } },
        select: { id: true },
      });

      const deptIds = departments.map(d => d.id);

      const deptUsers = await this.prisma.user.findMany({
        where: {
          departments: { some: { id: { in: deptIds } } },
          NOT: { userRole: { hasSome: ['SUPERADMIN'] } },
        },
        select: { id: true },
      });

      const userIds = new Set(deptUsers.map(u => u.id));

      return reports.filter(r => userIds.has(r.userId));
    }

    return reports.filter(r => r.userId === user.id);
  }

  private groupByWeekAndDepartment(reports: any[]) {
    const weeks = new Map<number, any>();

    for (const report of reports) {
      if (!weeks.has(report.week)) {
        weeks.set(report.week, {
          week: report.week,
          title: `Weekly Report - Week ${report.week}`,
          departments: [],
          deptMap: new Map<string, any>(),
        });
      }

      const weekEntry = weeks.get(report.week);
      const deptMap = weekEntry.deptMap;

      const userDepartments = report.user.departments ?? [];

      if (userDepartments.length === 0) {
        if (!deptMap.has('NO_DEPARTMENT')) {
          deptMap.set('NO_DEPARTMENT', {
            department: null,
            reports: [],
          });
        }

        deptMap.get('NO_DEPARTMENT').reports.push({
          ...report,
          tasks: [],
        });

        continue;
      }

      for (const dept of userDepartments) {
        if (!deptMap.has(dept.id)) {
          deptMap.set(dept.id, {
            department: dept,
            reports: [],
          });
        }

        deptMap.get(dept.id).reports.push(report);
      }
    }

    for (const weekEntry of weeks.values()) {
      weekEntry.departments = Array.from(weekEntry.deptMap.values());
      delete weekEntry.deptMap;
    }

    return Array.from(weeks.values());
  }

  async listDepartmentWeeklyReports(userId: string) {
    try {

      const user = await this.prisma.user.findUnique({
        where: {
          id: userId,
          userRole: {
            hasSome: ['DEPT_MANAGER', "SUPERADMIN", "ADMIN"]
          }
        }
      })

      if (!user) bad('Unauthorized');

      const departments = await this.prisma.department.findMany({
        where: {
          approver: {
            some: {
              userId: user.id
            }
          }
        }
      })

      const deptIds = departments.map(d => d.id);

      const baseFindArgs = {
        where: {
          departmentId: {
            in: deptIds
          },
          status: ReportStatus.SUBMITTED
        }
      }

      if (user.userRole.includes('SUPERADMIN') || user.userRole.includes('ADMIN')) {
        delete baseFindArgs.where.departmentId;

      }

      if (user.userRole.includes('DEPT_MANAGER')) {
        delete baseFindArgs.where.status;
        baseFindArgs.where.departmentId = {
          in: deptIds
        }
      }

      const reports = await this.prisma.departmentWeeklyReport.findMany({
        ...baseFindArgs,
        include: {
          department: true,
          reports: {
            include: {
              task: true,
              attachments: {
                select: {
                  uri: true,
                  name: true,
                  id: true,
                  size: true
                }
              }
            }
          }
        },
        orderBy: { createdAt: 'desc' },
      })

      const weeks = new Map<number, any>()

      for (const report of reports) {
        if (!weeks.has(report.week)) {
          weeks.set(report.week, {
            week: report.week,
            title: `Weekly Report - Week ${report.week}`,
            departments: [],
            deptMap: new Map<string, any>(),
          });
        }


        const weekEntry = weeks.get(report.week);
        const deptMap = weekEntry.deptMap;

        const userDepartments = report.department;

        if (userDepartments) {
          if (!deptMap.has('NO_DEPARTMENT')) {
            deptMap.set('NO_DEPARTMENT', {
              department: userDepartments,
              tasks: [],
              status: report.status
            });
          }

          deptMap.get('NO_DEPARTMENT').tasks.push(...report.reports);

          continue;
        }

        if (!deptMap.has(userDepartments.id)) {
          deptMap.set(userDepartments.id, {
            department: userDepartments,
          });
        }

        deptMap.get(userDepartments.id).tasks.push(...report.reports);
      }


      for (const weekEntry of weeks.values()) {
        weekEntry.departments = Array.from(weekEntry.deptMap.values());
        delete weekEntry.deptMap;
      }

      return Array.from(weeks.values());
    } catch (error) {
      bad(error);
    }
  }


}

function getCurrentWeek(date = new Date()): number {
  const d = new Date(
    Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()),
  );

  const dayNum = d.getUTCDay() || 7; // Sunday → 7
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);

  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));

  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}
