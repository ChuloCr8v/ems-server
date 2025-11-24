import { Injectable, BadRequestException, NotFoundException, ForbiddenException, ConflictException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
// import { bad } from 'src/utils/error.utils';
import { FillAppraisalDto, GetAppraisalsDto, GetHRAppraisalsDto, SendToDepartmentDto } from './dto/apppraisal.dto';
import { Prisma } from '@prisma/client';

@Injectable()
export class AppraisalService {
    constructor(private readonly prisma: PrismaService) {}
     // Manager sends appraisals to department (makes them available for filling)
    async sendAppraisalToTeam(userId: string, data: SendToDepartmentDto) {
        const { quarter, year, departmentId } = data;
        try {
            return this.prisma.$transaction(async (tx) => {
                //Verify manager is department head
                const department = await tx.department.findFirst({
                    where: {
                        id: departmentId,
                        approver: {
                          some: { role: 'DEPT_MANAGER', userId: userId }  
                        },
                    },
                });
                if(!department) {
                    throw new ForbiddenException('Not authorized to send appraisals for this department')
                }

                //Update all GENERATED appraisals for this department and quater to PENDING
                const result = await tx.appraisal.updateMany({
                    where: {
                        quarter,
                        year,
                        appraised: {
                            departments: { some: { id: departmentId } },
                        },
                        status: 'GENERATED'
                    },
                    data: { status: 'PENDING'},
                });
                return {
                    message: `Sent ${result.count} appraisals to department team for filling`,
                    count: result.count,
                    department: department.name,
                    quarter,
                    year
                }
            })
        } catch (error) {
            if (error instanceof BadRequestException || 
                    error instanceof NotFoundException || 
                    error instanceof ConflictException) {
                throw error;
            }
            throw new BadRequestException('Failed to create KPI categories:' + error.message);
                        
        }
    }

 
    async fillAppraisal(userId: string, appraisalId: string, data: FillAppraisalDto) {
        return this.prisma.$transaction(async (tx) => {
            const appraisal = await tx.appraisal.findUnique({
                where: { 
                    id: appraisalId, 
                    appraisedId: userId 
                },
                include: {
                    kpi: {
                        include: {
                            categories: {
                                include: { objectives: true }
                            }
                        }
                    }
                }
            });

            if (!appraisal) {
                throw new NotFoundException('Appraisal not found');
            }

             // Employee can only update PENDING or DRAFT appraisals
                if (!['PENDING', 'DRAFT'].includes(appraisal.status)) {
                    throw new BadRequestException('Can only update appraisals in PENDING or DRAFT status');
                }


            // Update objectives ratings and comments
            if (data.objectiveRatings) {
                for (const ratingUpdate of data.objectiveRatings) {
                    await tx.objective.updateMany({
                        where: {
                            id: ratingUpdate.objectiveId,
                            category: {
                                kpi: { appraisalId }
                            }
                        },
                        data: {
                            rating: ratingUpdate.rating,
                            comment: ratingUpdate.comment
                        }
                    });
                }
            }

            // Update goals and achievements
            if (data.goalsAndAchievements) {
                await tx.goalsAndAchievement.update({
                    where: { appraisalId },
                    data: {
                        achievements: data.goalsAndAchievements.achievements,
                        goals: data.goalsAndAchievements.goals
                    }
                });
            }

            // Update feedback responses
            if (data.feedbackResponses) {
                for (const response of data.feedbackResponses) {
                    await tx.feedbackQuestion.updateMany({
                        where: {
                            id: response.questionId,
                            feedback: { appraisalId }
                        },
                        data: { response: response.response }
                    });
                }
            }

            // Handle status transitions
            let newStatus = appraisal.status;
            let submittedAt = appraisal.submittedAt;

            if (data.submit) {
                // Validate that all required fields are filled before submission
                const validationError = await this.validateAppraisalCompletion(appraisalId);
                if (validationError) {
                    throw new BadRequestException(validationError);
                }

                newStatus = 'SUBMITTED';
                submittedAt = new Date();
                // Calculate final rating summary when submitting
                await this.calculateRatingSummary(appraisalId);
            } else if (appraisal.status === 'PENDING') {
                // First time saving - transition from PENDING to DRAFT
                newStatus = 'DRAFT';
            }
            // If already DRAFT and not submitting, remain DRAFT

            // Update appraisal status
            const updatedAppraisal = await tx.appraisal.update({
                where: { id: appraisalId },
                data: {
                    status: newStatus,
                    submittedAt: submittedAt
                },
                include: this.getAppraisalIncludes()
            });

            const message = data.submit 
                ? 'Appraisal submitted successfully' 
                : appraisal.status === 'PENDING' 
                    ? 'Appraisal started and saved as draft' 
                    : 'Appraisal saved as draft';

            return {
                ...updatedAppraisal,
                message
            };
        });
    }

    //Manager reviews and appraises 
    async getUserAppraisals(userId: string, userRole: string, filters?: GetAppraisalsDto) {
        let where: any = {};

        switch (userRole) {
            case 'USER':
                where.appraisedId = userId;
                 // Employees can only see PENDING, DRAFT, SUBMITTED, and APPRAISED appraisals
                where.status = { in: ['PENDING', 'DRAFT', 'SUBMITTED', 'APPRAISED'] };
                break;

            case 'DEPT_MANAGER':
                where.appraiserId = userId;
                // Managers can only see GENERATED, SUBMITTED and APPRAISED appraisals (not DRAFT)
                where.status = { in: ['GENERATED', 'SUBMITTED', 'APPRAISED'] };
                break;

            case 'HR':
                where.status = 'APPRAISED';
                break;

            case 'ADMIN':
                // Admin sees everything
                break;

            default:
                throw new ForbiddenException('You are not authorized to view appraisals');
        }

        // Apply common filters
        if (filters?.status && userRole !== 'USER' && userRole !== 'DEPT_MANAGER') {
            where.status = filters.status;
        }

        if (filters?.quarter) {
            where.quarter = filters.quarter;
        }

        if (filters?.year) {
            where.year = filters.year;
        }

        // HR/Admin specific filters
        if ((userRole === 'HR' || userRole === 'ADMIN') && filters) {
            const hrFilters = filters as GetHRAppraisalsDto;
            
            if (hrFilters.departmentId) {
                where.appraised = { departmentId: hrFilters.departmentId };
            }

            if (hrFilters.managerId) {
                where.appraiserId = hrFilters.userId;
            }

            if (hrFilters.employeeId) {
                where.appraisedId = hrFilters.userId;
            }
        }

        const include = this.getRoleSpecificIncludes(userRole);
        const appraisals = await this.prisma.appraisal.findMany({
            where,
            include,
            orderBy: this.getRoleSpecificOrderBy(userRole)
        });

        // For managers, add count of rated objectives
        if (userRole === 'DEPT_MANAGER') {
            return await this.addRatedObjectivesCount(appraisals);
        }

        return appraisals;
    }

    async getAppraisalById(userId: string, userRole: string, appraisalId: string) {
        const appraisal = await this.prisma.appraisal.findUnique({
            where: { id: appraisalId },
            include: this.getAppraisalIncludes()
        });

        if (!appraisal) {
            throw new NotFoundException('Appraisal not found');
        }

        // Check access based on role
        switch (userRole) {
            case 'USER':
                if (appraisal.appraisedId !== userId) {
                    throw new ForbiddenException('You can only view your own appraisals');
                }
                break;

            case 'DEPT_MANAGER':
                if (appraisal.appraiserId !== userId) {
                    throw new ForbiddenException('You can only view appraisals assigned to you');
                }
                // Managers can only view SUBMITTED and APPRAISED appraisals
                if (!['SUBMITTED', 'APPRAISED'].includes(appraisal.status)) {
                    throw new ForbiddenException('You can only view SUBMITTED or APPRAISED appraisals');
                }
                break;

            case 'HR':
                // HR can only view APPRAISED appraisals
                if (appraisal.status !== 'APPRAISED') {
                    throw new ForbiddenException('HR can only view appraisals with APPRAISED status');
                }
                break;

            case 'ADMIN':
                // Admin can view everything
                break;

            default:
                throw new ForbiddenException('You are not authorized to view this appraisal');
        }

        return appraisal;
    }


    // async calculateRatingSummary(appraisalId: string) {
    //     try {
    //         const appraisal = await this.prisma.appraisal.findUnique({
    //             where: { id: appraisalId },
    //             include: {
    //                 kpi: {
    //                     include: {
    //                         categories: {
    //                             include: {
    //                                 objectives: true
    //                             }
    //                         }
    //                     }
    //                 }
    //             }
    //         });

    //         if (!appraisal) {
    //             throw new NotFoundException('Appraisal not found');
    //         }

    //         // Define category mappings
    //         const categoryMappings = {
    //             'TECHNICAL SKILL': 'technicalPerformance',
    //             'TEAM COLLABORATION': 'teamCollaboration',
    //             'INITIATIVE & LEADERSHIP': 'initiativesLeadership',
    //             'DEPARTMENTAL KPI': 'departmentalKpi'
    //         };

    //         const summary = {
    //             technicalPerformance: 0,
    //             teamCollaboration: 0,
    //             initiativesLeadership: 0,
    //             departmentalKpi: 0,
    //             overallPerformance: 0
    //         };

    //         let totalRatedCategories = 0;

    //         // Calculate average rating for each category
    //         if (appraisal.kpi && appraisal.kpi.length) {
    //             for (const kpi of appraisal.kpi) {
    //                 if (!kpi.categories) continue;
    //                 for (const category of kpi.categories) {
    //                     const validObjectives = category.objectives.filter(obj => obj.rating !== null && obj.rating !== undefined);
    //                     if (validObjectives.length > 0) {
    //                         const average = validObjectives.reduce((sum, obj) => sum + obj.rating, 0) / validObjectives.length;
    //                         const mappedField = categoryMappings[category.name];
    //                         if (mappedField) {
    //                             summary[mappedField] = Math.round(average * 10) / 10;
    //                             totalRatedCategories++;
    //                         }
    //                     }
    //                 }
    //             }
    //         }

    //         // Calculate overall performance
    //         if (totalRatedCategories > 0) {
    //             const total = Object.values(summary).reduce((sum: number, value: number) => sum + value, 0) - summary.overallPerformance;
    //             summary.overallPerformance = Math.round((total / totalRatedCategories) * 10) / 10;
    //         }

    //         // Update or create rating summary
    //         await this.prisma.ratingSummary.upsert({
    //             where: { appraisalId },
    //             update: summary,
    //             create: {
    //                 ...summary,
    //                 appraisalId
    //             }
    //         });

    //         return summary;
    //     } catch (error) {
    //         if (error instanceof BadRequestException || 
    //                   error instanceof NotFoundException || 
    //                   error instanceof ConflictException) {
    //             throw error;
    //         }
    //         throw new BadRequestException('Failed to calculate rating summary:' + error.message);
    //     }
    // }

    /////////////////////////////////////////////// HELPER METHODS ///////////////////////////////////////////

      private getAppraisalIncludes() {
        return {
        appraised: {
            select: { id: true, firstName: true, lastName: true, email: true, department: true }
        },
        appraiser: {
            select: { id: true, firstName: true, lastName: true, email: true }
        },
        kpi: {
            include: {
            categories: {
                include: {
                objectives: true,
                department: true
                }
            }
            }
        },
        goalsAndAchievement: true,
        feedback: {
            include: { questions: true }
        },
        ratingSummary: true
        };
      }

      private getRoleSpecificOrderBy(userRole: string): Prisma.AppraisalOrderByWithRelationInput {
        switch (userRole) {
            case 'USER':
                return { createdAt: 'desc' };
            case 'DEPT_MANAGER':
                return { updatedAt: 'desc' };
            case 'HR':
            case 'ADMIN':
                return { appraisedAt: 'desc' };
            default:
                return { createdAt: 'desc' };
        }
}

    private getRoleSpecificIncludes(userRole: string) {
        const baseInclude = {
            ratingSummary: true,
            kpi: {
                include: {
                    categories: {
                        include: {
                            objectives: true
                        }
                    }
                }
            },
            goalsAndAchievement: true
        };

        switch (userRole) {
            case 'USER':
                return {
                    ...baseInclude,
                    appraiser: {
                        select: {
                            id: true,
                            firstName: true,
                            lastName: true,
                            email: true,
                            position: true
                        }
                    },
                    feedback: {
                        include: {
                            questions: true
                        }
                    },
                    signatures: true
                };

            case 'DEPT_MANAGER':
                return {
                    ...baseInclude,
                    appraised: {
                        select: {
                            id: true,
                            firstName: true,
                            lastName: true,
                            email: true,
                            position: true,
                            department: {
                                select: {
                                    id: true,
                                    name: true
                                }
                            }
                        }
                    }
                    // Remove _count entirely
                };

            case 'HR':
            case 'ADMIN':
                return {
                    ...baseInclude,
                    appraised: {
                        select: {
                            id: true,
                            firstName: true,
                            lastName: true,
                            email: true,
                            position: true,
                            department: {
                                select: {
                                    id: true,
                                    name: true
                                }
                            }
                        }
                    },
                    appraiser: {
                        select: {
                            id: true,
                            firstName: true,
                            lastName: true,
                            email: true,
                            position: true
                        }
                    },
                    feedback: {
                        include: {
                            questions: true
                        }
                    },
                    signatures: true
                };

            default:
                return baseInclude;
        }
    }

    private async calculateRatingSummary(appraisalId: string) {
        const appraisal = await this.prisma.appraisal.findUnique({
            where: { id: appraisalId },
            include: {
                kpi: {
                    include: {
                        categories: {
                            include: { objectives: true }
                        }
                    }
                }
            }
        });

        if (!appraisal?.kpi?.[0]) return; // Check if first KPI exists

        const kpi = appraisal.kpi[0]; // Get the first KPI
        const summary: any = {};
        let totalOverall = 0;
        let categoryCount = 0;

        for (const category of kpi.categories) {
            const validRatings = category.objectives.filter(obj => obj.rating !== null);
            
            if (validRatings.length > 0) {
                const categoryAverage = validRatings.reduce((sum, obj) => sum + (obj.rating || 0), 0) / validRatings.length;
                
                // Map category names to summary fields
                const summaryField = this.mapCategoryToSummaryField(category.name);
                if (summaryField) {
                    summary[summaryField] = Math.round(categoryAverage * 10) / 10;
                    totalOverall += categoryAverage;
                    categoryCount++;
                }
            }
        }

        if (categoryCount > 0) {
            summary.overallPerformance = Math.round((totalOverall / categoryCount) * 10) / 10;
        }

        await this.prisma.ratingSummary.upsert({
            where: { appraisalId },
            update: summary,
            create: { appraisalId, ...summary }
        });
    }

    private mapCategoryToSummaryField(categoryName: string): string | null {
        const mapping: { [key: string]: string } = {
            'TECHNICAL SKILL': 'technicalPerformance',
            'TEAM COLLABORATION': 'teamCollaboration',
            'INITIATIVE & LEADERSHIP': 'initiativesLeadership',
            'DEPARTMENT KPI': 'departmentalKpi'
        };
        return mapping[categoryName] || null;
    }

    private async addRatedObjectivesCount(appraisals: any[]) {
    const appraisalsWithCounts = await Promise.all(
        appraisals.map(async (appraisal) => {
            let ratedObjectivesCount = 0;
            let totalObjectivesCount = 0;
            
            // Fix: appraisal.kpi is an array
            const kpi = appraisal.kpi?.[0];
            if (kpi?.categories) {
                for (const category of kpi.categories) {
                    const ratedInCategory = category.objectives.filter(obj => obj.rating !== null).length;
                    ratedObjectivesCount += ratedInCategory;
                    totalObjectivesCount += category.objectives.length;
                }
            }

            return {
                ...appraisal,
                ratedObjectivesCount,
                totalObjectivesCount
            };
        })
    );

    return appraisalsWithCounts;
 }

    private async validateAppraisalCompletion(appraisalId: string): Promise<string | null> {
        const appraisal = await this.prisma.appraisal.findUnique({
            where: { id: appraisalId },
            include: {
                kpi: {
                    include: {
                        categories: {
                            include: {
                                objectives: true
                            }
                        }
                    }
                },
                goalsAndAchievement: true,
                feedback: {
                    include: {
                        questions: true
                    }
                }
            }
        });

        if (!appraisal) {
            return 'Appraisal not found';
        }

        // Appraisal.kpi is an array, so we need to access the first element or handle multiple
        const kpi = appraisal.kpi?.[0]; // Get the first KPI
        const allObjectives = kpi?.categories.flatMap(cat => cat.objectives) || [];
        const unratedObjectives = allObjectives.filter(obj => obj.rating === null);
        
        if (unratedObjectives.length > 0) {
            return `Please rate all KPI objectives. ${unratedObjectives.length} objective(s) remaining.`;
        }

        // Check if goals and achievements are filled
        if (!appraisal.goalsAndAchievement?.achievements?.length || 
            !appraisal.goalsAndAchievement?.goals?.length) {
            return 'Please fill in both achievements and goals sections.';
        }

        // Check if feedback questions are answered
        const unansweredFeedback = appraisal.feedback?.questions.filter(q => !q.response);
        if (unansweredFeedback?.length > 0) {
            return `Please answer all feedback questions. ${unansweredFeedback.length} question(s) remaining.`;
        }

        return null; // No validation errors
    }
}