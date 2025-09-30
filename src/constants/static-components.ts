import { ComponentCategory, SalaryCalculationType, SalaryType } from "@prisma/client";

export const STATIC_EARNING_COMPONENTS = [
    {
        title: 'Basic',
        type: SalaryType.EARNING,
        category: ComponentCategory.STATIC_EARNING,
        calculations: SalaryCalculationType.PERCENTAGE,
        amount: 20,
    },

    {
        title: 'Housing',
        type: SalaryType.EARNING,
        category: ComponentCategory.STATIC_EARNING,
        calculations: SalaryCalculationType.PERCENTAGE,
        amount: 20,
    },

    {
        title: 'Transport',
        type: SalaryType.EARNING,
        category: ComponentCategory.STATIC_EARNING,
        calculations: SalaryCalculationType.PERCENTAGE,
        amount: 20,
    },

    {
        title: 'Entertainment',
        type: SalaryType.EARNING,
        category: ComponentCategory.STATIC_EARNING,
        calculations: SalaryCalculationType.PERCENTAGE,
        amount: 15,
    },

    {
        title: 'Wardrope',
        type: SalaryType.EARNING,
        category: ComponentCategory.STATIC_EARNING,
        calculations: SalaryCalculationType.PERCENTAGE,
        amount: 15,
    },

    {
        title: 'LifeStyle',
        type: SalaryType.EARNING,
        category: ComponentCategory.STATIC_EARNING,
        calculations: SalaryCalculationType.PERCENTAGE,
        amount: 10,
    }
];

export const STATIC_DEDUCTION_COMPONENTS = [
    // {
    //     title: 'Pension',
    //     type: SalaryType.DEDUCTION,
    //     category: ComponentCategory.STATIC_DEDUCTION,
    //     calculations: SalaryCalculationType.PERCENTAGE,
    //     amount: 8,
    // },

    // {
    //     title: 'Payee(Tax)',
    //     type: SalaryType.DEDUCTION,
    //     category: ComponentCategory.STATIC_DEDUCTION,
    //     calculations: SalaryCalculationType.PERCENTAGE,
    //     amount: 8,
    // }
]