import { Injectable } from '@nestjs/common';
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
                    userTask: true
                },
            });

            const reports = [];

            for (const user of users) {
                const taskIds = user.userTask
                    .map((ut) => ut.taskId)
                    .filter(Boolean);

                if (!taskIds.length) {
                    continue;
                }

                console.log("user id", user.id)

                // 4. Check if a report already exists for this user this week
                // const existing = await this.prisma.report.findFirst({
                //     where: {
                //         week,
                //         userId: user.id,
                //     },
                // });

                // if (existing) {
                //     // Don't duplicate
                //     reports.push(existing);
                //     continue;
                // }

                const newReport = await this.prisma.$transaction(async (tx) => {
                    return tx.report.create({
                        data: {
                            week,
                            title: `Weekly Report - Week ${week}`,

                            user: {
                                connect: { id: user.id },
                            },

                            tasks: {
                                connect: taskIds.map((id) => ({ id })),
                            },
                        },
                        include: {
                            tasks: true,
                            user: true,
                        },
                    });
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
                            category: true, assignees: {
                                include: {
                                    user: true
                                }
                            }
                        }
                    },
                    user: true,
                },
                orderBy: {
                    createdAt: 'desc',
                },
            });

            const user = await this.prisma.user.findUnique({ where: { id: userId } })
            if (!user) bad("User not found");

            if (user.userRole.includes("ADMIN")) return reports
            if (user.userRole.includes("DEPT_MANAGER")) {
                const managedDepartments = await this.prisma.department.findMany({
                    where: {
                        approver: {
                            some: { id: user.id }
                        }
                    },
                    select: { id: true },
                });
                const managedDeptIds = managedDepartments.map(dept => dept.id);
                const deptUsers = await this.prisma.user.findMany({
                    where: {
                        departments: {
                            some: {
                                id: { in: managedDeptIds },
                            },
                        },
                    },
                    select: { id: true },
                });
                const deptUserIds = deptUsers.map(u => u.id);
                const deptReports = reports.filter(report => deptUserIds.includes(report.userId));
                return deptReports;
            }
            if (user.userRole.includes("USER")) {
                const userReports = reports.filter(report => report.userId === userId);
                return userReports;
            }

            return reports;
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