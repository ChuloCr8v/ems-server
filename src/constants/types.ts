import { Prisma, Role } from "@prisma/client";

export const UserSelect = {
    select: {
        id: true,
        eId: true,
        email: true,
        firstName: true,
        lastName: true,
        userRole: true,
        role: true,
        phone: true,
        address: true,
        
    }
} satisfies Prisma.UserDefaultArgs;

export type AuthUsers = Prisma.UserGetPayload<typeof UserSelect>;

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