import { Injectable } from '@nestjs/common';
import {
  Report,
  Task,
  UserTask,
  TaskStatus,
  Prisma,
  User,
  ReportStatus,
  Department,
  ProjectLabels,
} from '@prisma/client';

import { PrismaService } from 'src/prisma/prisma.service';
import { bad, mustHave } from 'src/utils/error.utils';
import { CreateDepartmentWeeklyReportDto } from './dto/report.dto';
import { randomBytes } from 'crypto';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ReportSubmittedEvent } from 'src/events/report.event';

const reportWithRelationsInclude = Prisma.validator<Prisma.ReportDefaultArgs>()(
  {
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
              user: true,
            },
          },
          projectLabels: true,
        },
      },
      user: {
        include: {
          departments: true,
        },
      },
    },
  },
);

type ReportWithRelations = Prisma.ReportGetPayload<{
  include: typeof reportWithRelationsInclude.include;
}>;

export interface ProjectGroup {
  project: ProjectLabels | { id: string; title: string };
  tasks: Task[];
}

export interface DepartmentWeeklyEntry {
  department: Department | null;
  projects: ProjectGroup[];
  week: number;
}

@Injectable()
export class ReportService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  private readonly reportWithRelations = reportWithRelationsInclude;

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
      const departmentField =
        department ??
        (user.defaultId ? user.defaultId : user.departments[0].id);

      const existingReport = await this.prisma.departmentWeeklyReport.findFirst(
        {
          where: {
            week,
            departmentId: departmentField,
          },
          include: {
            reports: true,
          },
        },
      );

      if (existingReport && existingReport.status === ReportStatus.SUBMITTED)
        bad(`Report for week ${week} has been submitted already`);
      if (existingReport && existingReport.status !== ReportStatus.SUBMITTED) {
        // Delete existing sub-reports
        await this.prisma.reportItem.deleteMany({
          where: {
            weeklyReportId: existingReport.id,
          },
        });

        // Update the main report
        const updatedReport = await this.prisma.departmentWeeklyReport.update({
          where: {
            id: existingReport.id,
          },
          data: {
            title,
            status: isDraft ? ReportStatus.DRAFT : ReportStatus.SUBMITTED,
            reports: {
              create: reports.map((r) => ({
                title: r.title,
                description: r.description,
                task: r.taskId
                  ? {
                      connect: {
                        id: r.taskId,
                      },
                    }
                  : undefined,
                project:
                  r.projectId && r.projectId.toLowerCase() !== 'unassigned'
                    ? {
                        connect: {
                          id: r.projectId,
                        },
                      }
                    : undefined,
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
                        user: true,
                      },
                    },
                    createdBy: true,
                  },
                },
              },
            },
            department: true,
          },
        });

        if (!isDraft) {
          this.eventEmitter.emit(
            'report.submitted',
            new ReportSubmittedEvent(
              updatedReport.id,
              userId,
              updatedReport.title,
              updatedReport.week,
              updatedReport.department.name,
            ),
          );
        }

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
              id: departmentField,
            },
          },
          reports: {
            create: reports.map((r) => ({
              title: r.title,
              description: r.description,
              task: r.taskId
                ? {
                    connect: {
                      id: r.taskId,
                    },
                  }
                : undefined,
              project:
                r.projectId && r.projectId.toLowerCase() !== 'unassigned'
                  ? {
                      connect: {
                        id: r.projectId,
                      },
                    }
                  : undefined,
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

      if (report.status === ReportStatus.SUBMITTED) {
        this.eventEmitter.emit(
          'report.submitted',
          new ReportSubmittedEvent(
            report.id,
            userId,
            report.title,
            report.week,
            report.department.name,
          ),
        );
      }

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

  async listWeeklyReportsByProjects(userId: string) {
    try {
      const user = await this.prisma.user.findUnique({ where: { id: userId } });
      if (!user) bad('User not found');

      const reports = await this.prisma.report.findMany({
        include: this.reportWithRelations.include,
        orderBy: { createdAt: 'desc' },
      });

      const accessibleReports = await this.filterReportsByRole(user, reports);

      const weeklyData = this.groupByWeekAndDepartment(accessibleReports);

      return weeklyData;
    } catch (error) {
      bad(error);
    }
  }

  async listWeeklyReports(userId: string) {
    try {
      const user = await this.prisma.user.findUnique({ where: { id: userId } });
      if (!user) bad('User not found');

      const reports = await this.prisma.report.findMany({
        include: this.reportWithRelations.include,
        orderBy: { createdAt: 'desc' },
      });

      const accessibleReports = await this.filterReportsByRole(user, reports);

      return this.groupByWeekDeptUser(accessibleReports);
    } catch (error) {
      bad(error);
    }
  }

  private groupByWeekDeptUser(reports: ReportWithRelations[]) {
    const weeks = new Map<
      number,
      {
        week: number;
        title: string;
        deptMap: Map<
          string,
          {
            department: Department | null;
            userMap: Map<
              string,
              {
                user: Pick<
                  User,
                  'id' | 'firstName' | 'lastName' | 'email' | 'userRole'
                >;
                tasks: Task[];
              }
            >;
          }
        >;
      }
    >();

    for (const report of reports) {
      if (!weeks.has(report.week)) {
        weeks.set(report.week, {
          week: report.week,
          title: `Weekly Report - Week ${report.week}`,
          deptMap: new Map(),
        });
      }

      const weekEntry = weeks.get(report.week)!;
      const userDepartments = report.user.departments ?? [];
      const user = report.user;
      const tasks = report.tasks;

      const depts: (Department | { id: string; name: string })[] =
        userDepartments.length > 0
          ? userDepartments
          : [{ id: 'NO_DEPARTMENT', name: 'No Department' }];

      for (const dept of depts) {
        if (!weekEntry.deptMap.has(dept.id)) {
          weekEntry.deptMap.set(dept.id, {
            department:
              dept.id === 'NO_DEPARTMENT' ? null : (dept as Department),
            userMap: new Map(),
          });
        }

        const deptEntry = weekEntry.deptMap.get(dept.id)!;
        if (!deptEntry.userMap.has(user.id)) {
          deptEntry.userMap.set(user.id, {
            user: {
              id: user.id,
              firstName: user.firstName,
              lastName: user.lastName,
              email: user.email,
              userRole: user.userRole,
            },
            tasks: [],
          });
        }

        deptEntry.userMap.get(user.id)!.tasks.push(...(tasks as any));
      }
    }

    return Array.from(weeks.values()).map((week) => ({
      week: week.week,
      title: week.title,
      departments: Array.from(week.deptMap.values()).map((dept) => ({
        department: dept.department,
        users: Array.from(dept.userMap.values()),
      })),
    }));
  }

  async getUserReports(userId: string) {
    try {
      const reports = await this.prisma.report.findMany({
        where: { userId },
        include: this.reportWithRelations.include,
        orderBy: { createdAt: 'desc' },
      });

      return reports;
    } catch (error) {
      bad(error);
    }
  }

  private async filterReportsByRole(
    user: User,
    reports: ReportWithRelations[],
  ): Promise<ReportWithRelations[]> {
    if (
      user.userRole.includes('ADMIN') ||
      user.userRole.includes('SUPERADMIN')
    ) {
      return reports;
    }

    if (user.userRole.includes('DEPT_MANAGER')) {
      const departments = await this.prisma.department.findMany({
        where: { approver: { some: { userId: user.id } } },
        select: { id: true },
      });

      const deptIds = departments.map((d) => d.id);

      const deptUsers = await this.prisma.user.findMany({
        where: {
          departments: { some: { id: { in: deptIds } } },
          NOT: { userRole: { hasSome: ['SUPERADMIN'] } },
        },
        select: { id: true },
      });

      const userIds = new Set(deptUsers.map((u) => u.id));

      return reports.filter((r) => userIds.has(r.userId));
    }

    return reports.filter((r) => r.userId === user.id);
  }

  private groupByWeekAndDepartment(
    reports: ReportWithRelations[],
  ): DepartmentWeeklyEntry[] {
    const flatEntries: DepartmentWeeklyEntry[] = [];
    const groupingMap = new Map<
      number,
      Map<
        string,
        { department: Department | null; projectMap: Map<string, ProjectGroup> }
      >
    >();

    for (const report of reports) {
      const week = report.week;
      if (!groupingMap.has(week)) {
        groupingMap.set(week, new Map());
      }
      const weekDepts = groupingMap.get(week)!;

      const userDepts: (Department | null)[] =
        report.user.departments.length > 0 ? report.user.departments : [null];

      for (const dept of userDepts) {
        const deptId = dept ? dept.id : 'NO_DEPARTMENT';
        if (!weekDepts.has(deptId)) {
          weekDepts.set(deptId, {
            department: dept,
            projectMap: new Map(),
          });
        }
        const deptEntry = weekDepts.get(deptId)!;
        const projectMap = deptEntry.projectMap;

        for (const task of report.tasks) {
          if (!task.projectLabels || task.projectLabels.length === 0) {
            if (!projectMap.has('UNASSIGNED')) {
              projectMap.set('UNASSIGNED', {
                project: { id: 'UNASSIGNED', title: 'Unassigned' },
                tasks: [],
              });
            }
            projectMap.get('UNASSIGNED')!.tasks.push(task as any); // Task includes relations not in Task base
          } else {
            for (const label of task.projectLabels) {
              if (!projectMap.has(label.id)) {
                projectMap.set(label.id, {
                  project: label,
                  tasks: [],
                });
              }
              projectMap.get(label.id)!.tasks.push(task as any);
            }
          }
        }
      }
    }

    for (const [week, weekDepts] of groupingMap) {
      for (const [deptId, deptEntry] of weekDepts) {
        flatEntries.push({
          department: deptEntry.department,
          projects: Array.from(deptEntry.projectMap.values()),
          week: week,
        });
      }
    }

    return flatEntries;
  }

  async listDepartmentWeeklyReports(userId: string) {
    try {
      const user = await this.prisma.user.findUnique({
        where: {
          id: userId,
          userRole: {
            hasSome: ['DEPT_MANAGER', 'SUPERADMIN', 'ADMIN'],
          },
        },
      });

      if (!user) bad('Unauthorized');

      const departments = await this.prisma.department.findMany({
        where: {
          approver: {
            some: {
              userId: user.id,
            },
          },
        },
      });

      const deptIds = departments.map((d) => d.id);

      const where: Prisma.DepartmentWeeklyReportWhereInput = {
        departmentId: {
          in: deptIds,
        },
        status: ReportStatus.SUBMITTED,
      };

      if (
        user.userRole.includes('SUPERADMIN') ||
        user.userRole.includes('ADMIN')
      ) {
        delete where.departmentId;
      }

      if (user.userRole.includes('DEPT_MANAGER')) {
        delete where.status;
        where.departmentId = {
          in: deptIds,
        };
      }

      const reports = await this.prisma.departmentWeeklyReport.findMany({
        where,
        include: {
          department: true,
          reports: {
            include: {
              task: true,
              project: true,
              weeklyReport: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      });

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
        const department = report.department;

        if (!deptMap.has(department)) {
          deptMap.set(department, {
            department,
            status: report.status,
            projectMap: new Map<string, any>(),
          });
        }

        const deptEntry = deptMap.get(department);
        const projectMap = deptEntry.projectMap;

        for (const taskReport of report.reports) {
          const project = taskReport?.project;

          if (!project) {
            if (!projectMap.has('UNASSIGNED')) {
              projectMap.set('UNASSIGNED', {
                project: {
                  id: 'UNASSIGNED',
                  title: 'Unassigned',
                },
                reports: [],
              });
            }

            projectMap.get('UNASSIGNED').reports.push(taskReport);
            continue;
          }

          if (!projectMap.has(project.id)) {
            projectMap.set(project.id, {
              project,
              reports: [],
            });
          }

          projectMap.get(project.id).reports.push(taskReport);
        }
      }

      for (const weekEntry of weeks.values()) {
        weekEntry.departments = Array.from(weekEntry.deptMap.values()).map(
          (dept: any) => {
            const projects = Array.from(dept.projectMap.values());

            delete dept.projectMap;

            return {
              department: dept.department,
              projects,
              status: dept.status,
            };
          },
        );

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
