import { Prisma } from "@prisma/client";

export const KpiSelect = {
    select: {
        id: true,
        appraisal: true,
        appraisalId: true,
        categories: {
            select: {
                name: true,
                objectives: true
            }
        },
        createdAt: true,
        updatedAt: true
    },
} satisfies Prisma.KpiDefaultArgs;

export type KpiSelectPayload = Prisma.KpiGetPayload<typeof KpiSelect>; 