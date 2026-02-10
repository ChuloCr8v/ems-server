import { Injectable } from '@nestjs/common';
import { Report, Task, UserTask, TaskStatus, Prisma, User } from '@prisma/client';

import { PrismaService } from 'src/prisma/prisma.service';
import { bad } from 'src/utils/error.utils';

@Injectable()
export class ReportService {
  constructor(private readonly prisma: PrismaService) { }

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
