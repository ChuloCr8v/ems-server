import { Injectable } from '@nestjs/common';
import { Report, TaskStatus } from '@prisma/client';
import { generate } from 'rxjs';
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
                    userTask: { include: { task: true } }
                }
            });

            const reports = [];

            for (const user of users) {
                const taskIds = user.userTask
                    .filter(({ task }) =>
                        task.status !== TaskStatus.COMPLETED ||
                        (task.status === TaskStatus.COMPLETED && !task.isReported)
                    )
                    .map(ut => ut.taskId)
                    .filter(Boolean);

                let existing = await this.prisma.report.findFirst({
                    where: { week, userId: user.id },
                    include: {
                        tasks: true,
                        user: true,
                    }
                });

                if (existing) {
                    if (taskIds.length > 0) {
                        await this.prisma.$transaction(async (tx) => {
                            await tx.report.update({
                                where: { id: existing.id },
                                data: {
                                    tasks: {
                                        connect: taskIds.map(id => ({ id }))
                                    }
                                }
                            });

                            await tx.task.updateMany({
                                where: {
                                    id: { in: taskIds },
                                    status: TaskStatus.COMPLETED
                                },
                                data: { isReported: true }
                            });
                        });

                        existing = await this.prisma.report.findFirst({
                            where: { id: existing.id },
                            include: { tasks: true, user: true }
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
                                connect: taskIds.length > 0
                                    ? taskIds.map(id => ({ id }))
                                    : []
                            }
                        },
                        include: {
                            tasks: true,
                            user: true,
                        }
                    });

                    if (taskIds.length > 0) {
                        await tx.task.updateMany({
                            where: {
                                id: { in: taskIds },
                                status: TaskStatus.COMPLETED
                            },
                            data: { isReported: true }
                        });
                    }

                    return report;
                });

                reports.push(newReport);
            }

            return reports;

        } catch (error) {
            console.error("Error generating weekly reports:", error);
            bad(error);
        }
    }


    async listWeeklyReports(userId: string) {
        try {
            const reports = await this.prisma.report.findMany({
                include: {
                    tasks: {
                        include: {
                            category: true,
                            assignees: { include: { user: true } },
                            taskIssues: true,
                        },
                    },
                    user: true,
                },
                orderBy: { createdAt: 'desc' },
            });

            const user = await this.prisma.user.findUnique({ where: { id: userId } });
            if (!user) bad("User not found");


            const groupByWeek = (reports: Report[]) => {
                const grouped = reports.reduce((acc, report) => {
                    const wk = report.week;

                    if (!acc[wk]) {
                        acc[wk] = {
                            week: wk,
                            title: `Weekly Report - Week ${wk}`,
                            reports: []
                        };
                    }

                    acc[wk].reports.push(report);
                    return acc;
                }, {} as Record<number, { week: number; title: string; reports: Report[] }>);

                return Object.values(grouped);
            };


            const reportReturnFormat = (reports: Report[]) => ({
                message: "Report Returned Successfully",
                totalWeeks: groupByWeek(reports).length,
                data: groupByWeek(reports)
            });


            if (user.userRole.includes("ADMIN")) {
                return reportReturnFormat(reports);
            }

            if (user.userRole.includes("DEPT_MANAGER")) {
                const managedDepartments = await this.prisma.department.findMany({
                    where: { approver: { some: { userId: user.id } } },
                    select: { id: true },
                });

                const managedDeptIds = managedDepartments.map(d => d.id);

                const deptUsers = await this.prisma.user.findMany({
                    where: {
                        departments: { some: { id: { in: managedDeptIds } } },
                    },
                    select: { id: true },
                });


                const deptUserIds = deptUsers.map(u => u.id);

                const deptReports = reports.filter(r => deptUserIds.includes(r.userId));

                return reportReturnFormat(deptReports);
            }


            if (user.userRole.includes("USER")) {
                const userReports = reports.filter(r => r.userId === userId);
                return reportReturnFormat(userReports);
            }

            return reportReturnFormat(reports);

        } catch (error) {
            bad(error);
        }
    }


}


function getCurrentWeek() {
    const currentDate = new Date();
    const firstDayOfYear = new Date(currentDate.getFullYear(), 0, 1);
    const pastDaysOfYear = (currentDate.valueOf() - firstDayOfYear.valueOf()) / 86400000;
    return Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7);
}   