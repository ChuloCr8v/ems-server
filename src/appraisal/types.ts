import { Prisma } from '@prisma/client';

export type KpiWithIncludes = Prisma.KpiGetPayload<{
    include: {
        categories: {
            include: {
                objectives: true
            }
        }
    }
}>;

export type AppraisalWithIncludes = Prisma.AppraisalGetPayload<{
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
        appraised: true,
        appraiser: true,
        goalsAndAchievement: true,
        feedback: {
            include: {
                questions: true
            }
        },
        summary: true
    }
}>;