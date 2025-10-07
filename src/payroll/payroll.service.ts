import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { STATIC_DEDUCTION_COMPONENTS, STATIC_EARNING_COMPONENTS } from 'src/constants/static-components';
import { ComponentCategory, SalaryCalculationType, SalaryType, TaxStatus } from '@prisma/client';
import { AddComponentDto, CalculateComponentDto, PayrollDto, UpdatePayrollDto } from './dto/payroll.dto';
import { bad } from 'src/utils/error.utils';
import { TaxService } from './tax.service';
import { connect } from 'http2';

@Injectable()
export class PayrollService {
    constructor(private readonly prisma: PrismaService, private readonly taxService: TaxService,) { }

    async calculatePayRoll(data: PayrollDto) {
        try {
            const { salary } = data;

            const deductibleSalary = salary * 0.6;
            const pensionAmt = deductibleSalary * 0.08;
            const CRAmount = salary - pensionAmt;
            const reliefAmount = CRAmount * 0.2 + 200000;
            const taxableAmount = CRAmount - reliefAmount;

            const existingComponents = await this.prisma.payrollComponent.findMany({
                where: {
                    userId: data.userId
                },
                select: {
                    title: true,
                    amount: true,
                    type: true,
                    calculations: true,
                    category: true,
                    duration: true,
                    startDate: true,
                    monthlyAmount: true,
                    annualAmount: true
                }
            })

            const { gross, deductions, components } = this.calculatePayrollComponents(salary, [...data.components, ...existingComponents]);

            const earningComponents = components.filter(c => c.type === "EARNING")
            const deductionComponents = components.filter(c => c.type === "DEDUCTION")

            const calculateTax = (amount: number) => {
                const taxBands = [
                    { limit: 300000, rate: 0.07 },
                    { limit: 300000, rate: 0.11 },
                    { limit: 500000, rate: 0.15 },
                    { limit: 500000, rate: 0.19 },
                    { limit: 1600000, rate: 0.21 },
                    { limit: Infinity, rate: 0.24 },
                ];
                let remaining = amount;
                let totalTax = 0;
                for (const band of taxBands) {
                    if (remaining <= 0) break;
                    const taxable = Math.min(remaining, band.limit);
                    totalTax += taxable * band.rate;
                    remaining -= taxable;
                }
                return totalTax;
            };

            const taxAmount = calculateTax(taxableAmount);

            const totalDeductions = taxAmount + deductions + pensionAmt
            const netSalary = gross - totalDeductions

            const extraDeductions = [
                {
                    title: 'Pension Contribution',
                    amount: pensionAmt / 12,
                    annualAmount: pensionAmt,
                    monthlyAmount: pensionAmt / 12,
                    type: SalaryType.DEDUCTION,
                    calculations: SalaryCalculationType.FIXED,
                    category: ComponentCategory.STATIC_DEDUCTION
                },
                {
                    title: 'PAYE Tax',
                    amount: taxAmount / 12,
                    annualAmount: taxAmount,
                    monthlyAmount: taxAmount / 12,
                    type: SalaryType.DEDUCTION,
                    calculations: SalaryCalculationType.FIXED,
                    category: ComponentCategory.STATIC_DEDUCTION

                },
            ];

            const response = {
                earningComponents,
                deductionComponents: [...deductionComponents, ...extraDeductions],
                taxableAmount,
                earnings: {
                    gross,
                    net: netSalary,
                },
                deductions: {
                    pension: pensionAmt, //correct
                    tax: taxAmount,//correct
                    totalDeductions: totalDeductions,
                },

            }

            console.log("calcultation response", response)


            return response
        } catch (error) {
            bad(error.message);
        }
    }

    async createPayroll(data: PayrollDto) {
        try {
            const existingPayroll = await this.prisma.payroll.findUnique({
                where: { id: data.userId },
            });
            if (existingPayroll) {
                throw bad("User already has a payroll");
            }

            const {
                earningComponents,
                deductionComponents,
                earnings,
                deductions,
                taxableAmount,
            } = await this.calculatePayRoll(data);

            const allComponents = [...earningComponents, ...deductionComponents];

            // bad("wait")
            const createdPayroll = await this.prisma.payroll.create({
                data: {
                    salary: data.salary ?? 0,
                    gross: earnings?.gross ?? 0,
                    net: earnings?.net ?? 0,
                    deductions: deductions?.totalDeductions ?? 0,
                    tax: deductions?.tax ?? 0,
                    pension: deductions?.pension ?? 0,
                    taxableIncome: taxableAmount ?? 0,
                    taxStatus: TaxStatus.CALCULATED,
                    user: { connect: { id: data.userId } },
                    component: {
                        create: allComponents.map(a => ({
                            ...a,
                            userId: data.userId,
                        })),
                    },
                },
                include: {
                    component: true,
                    user: {
                        select: {
                            id: true,
                            eId: true,
                            firstName: true,
                            lastName: true,
                            jobType: true,
                        },
                    },
                },
            });

            // const customComponents = allComponents.filter(a => a.category === ComponentCategory.CUSTOM_DEDUCTION || a.category === ComponentCategory.CUSTOM_EARNING)

            // console.log(customComponents)
            // if (customComponents.length > 0) {
            //     await this.prisma.$transaction(
            //         customComponents.map(component =>
            //             this.prisma.payrollComponent.create({
            //                 data: {
            //                     ...component,
            //                     payroll: { connect: { id: createdPayroll.id } },
            //                     user: { connect: { id: data.userId } }
            //                 },
            //             })
            //         )
            //     );
            // }

            return createdPayroll;
        } catch (error) {
            console.log(error)
            bad(error)
        }
    }



    // async createStaticComponents(
    //     salary: number,
    //     existingComponents?: AddComponentDto[]
    // ): Promise<{ gross: number; net: number; deductions: number; components: any[] }> {
    //     // console.log('createStaticComponents called with salary:', salary);
    //     // console.log('existingComponents:', existingComponents);

    //     try {
    //         let gross = 0;
    //         let deductions = 0;
    //         const components = [];

    //         // Define static earning/deduction components
    //         const earningComponents = existingComponents.length
    //             ? [...existingComponents.filter(e => e.category === ComponentCategory.STATIC_EARNING), ...STATIC_EARNING_COMPONENTS]
    //             : STATIC_EARNING_COMPONENTS;

    //         const deductionComponents = existingComponents.length
    //             ? [...existingComponents.filter(e => e.category === ComponentCategory.STATIC_DEDUCTION), ...STATIC_DEDUCTION_COMPONENTS]
    //             : STATIC_DEDUCTION_COMPONENTS;

    //         const staticEarningComponents = earningComponents.map(comp => {
    //             const { monthlyAmount, annualAmount } = this.calculateComponentAmounts(
    //                 salary,
    //                 comp.amount,
    //                 comp.calculations
    //             );

    //             return {
    //                 ...comp,
    //                 monthlyAmount,
    //                 annualAmount
    //             };
    //         });

    //         const staticDeductionComponents = deductionComponents.map(comp => {
    //             const { monthlyAmount, annualAmount } = this.calculateComponentAmounts(
    //                 salary,
    //                 comp.amount,
    //                 comp.calculations
    //             );

    //             return {
    //                 ...comp,
    //                 monthlyAmount,
    //                 annualAmount
    //             };
    //         });


    //         // Add earnings
    //         for (const component of staticEarningComponents) {
    //             components.push(component);
    //             gross += component.annualAmount;
    //         }

    //         // Add deductions, skipping excluded titles
    //         const excludedTitles = ['Pension Contribution', 'NHF Contribution', 'PAYE Tax'];

    //         for (const component of staticDeductionComponents) {
    //             if (!excludedTitles.includes(component.title)) {
    //                 components.push(component);
    //                 deductions += component.annualAmount;
    //             }
    //         }

    //         const net = gross - deductions;

    //         return { gross, deductions, net, components };
    //     } catch (error) {
    //         if (
    //             error instanceof BadRequestException ||
    //             error instanceof NotFoundException ||
    //             error instanceof ConflictException
    //         ) {
    //             throw error;
    //         }
    //         throw new BadRequestException('Failed to create static component: ' + error.message);
    //     }
    // }


    private calculatePayrollComponents(salary: number, existingComponents: AddComponentDto[]): { gross: number; net: number; deductions: number; components: CalculateComponentDto[] } {
        if (!existingComponents) return

        let gross = 0;
        let deductions = 0;
        const components = [];

        //calculate static earning/deduction components
        const staticEarningComponents = this.calculateComponentAmounts(
            salary,
            STATIC_EARNING_COMPONENTS,
        );

        const staticDeductionComponents = this.calculateComponentAmounts(
            salary,
            STATIC_DEDUCTION_COMPONENTS,
        );

        //calculate custom earning/deduction components

        //Define custom earning/deduction components
        const customEarning = existingComponents.length
            ? existingComponents.filter(e => e.category === ComponentCategory.CUSTOM_EARNING && e.type === SalaryType.EARNING) : []

        const customDeduction = existingComponents.length
            ? existingComponents.filter(e => e.category === ComponentCategory.CUSTOM_DEDUCTION && e.type === SalaryType.DEDUCTION) : []

        const customEarningComponents = this.calculateComponentAmounts(
            salary,
            customEarning,
        );

        const customDeductionComponents = this.calculateComponentAmounts(
            salary,
            customDeduction,
        );

        // Add earnings

        const allEarningComponents = [...customEarningComponents, ...staticEarningComponents]

        for (const component of allEarningComponents) {
            components.push(component);
            gross += component.annualAmount;
        }

        // Add deductions, skipping excluded titles
        const allDeductionComponents = [...customDeductionComponents, ...staticDeductionComponents]

        const excludedTitles = ['Pension Contribution', 'NHF Contribution', 'PAYE Tax'];

        for (const component of allDeductionComponents) {
            if (!excludedTitles.includes(component.title)) {
                components.push(component);
                deductions += component.annualAmount;
            }
        }

        const net = gross - deductions;

        return { gross, deductions, net, components };


    }


    async createCustomComponent(payrollId: string, data: AddComponentDto) {
        return
        // try {
        //     const payroll = await this.findPayroll(payrollId);
        //     //Find component category based on salary type
        //     const category = data.type === SalaryType.EARNING
        //         ? ComponentCategory.CUSTOM_EARNING
        //         : ComponentCategory.CUSTOM_DEDUCTION;

        //     //Calculate component amounts
        //     const { monthlyAmount, annualAmount } = this.calculateComponentAmounts(
        //         payroll.salary,
        //         data.amount,
        //         data.calculations
        //     );


        //     //Create the custom component
        //     await this.prisma.payrollComponent.create({
        //         data: {
        //             ...data,
        //             category,
        //             monthlyAmount,
        //             annualAmount,
        //             payrollId
        //         },
        //     });

        //     //Recalculate and update payroll totals
        //     return this.recalculatePayrollTotals(payrollId);
        // } catch (error) {
        //     if (error instanceof BadRequestException ||
        //         error instanceof NotFoundException ||
        //         error instanceof ConflictException) {
        //         throw error;
        //     }
        //     throw new BadRequestException('Failed to create custom component:' + error.message);
        // }
    }

    async removeCustomComponent(id: string) {
        try {
            const component = await this.prisma.payrollComponent.findUnique({
                where: { id },
                include: { payroll: true }
            });
            if (!component) {
                throw bad("Component Not Found");
            }

            //Only allow removal of custom components
            if (component.category !== ComponentCategory.CUSTOM_EARNING &&
                component.category !== ComponentCategory.CUSTOM_DEDUCTION
            ) {
                throw bad("Cannot remove static components");
            }

            //Delete the component
            await this.prisma.payrollComponent.delete({
                where: { id },
            });

            //Recalculate the update payroll totals 
            return this.recalculatePayrollTotals(component.payrollId);
        } catch (error) {
            if (error instanceof BadRequestException ||
                error instanceof NotFoundException ||
                error instanceof ConflictException) {
                throw error;
            }
            throw new BadRequestException('Failed to remove custom component:' + error.message);
        }
    }

    async updateStaticComponent(payrollId: string, title: string, amount: number) {
        return
        // try {
        //     const payroll = await this.findPayroll(payrollId);
        //     //Find the static component
        //     const component = payroll.component.find(
        //         comp => comp.title === title &&
        //             (comp.category === ComponentCategory.STATIC_EARNING ||
        //                 comp.category === ComponentCategory.STATIC_DEDUCTION)
        //     );

        //     if (!component) {
        //         throw bad("Static Component Not Found");
        //     }
        //     //Update the component amount and recalculate amounts
        //     const { monthlyAmount, annualAmount } = this.calculateComponentAmounts(
        //         payroll.salary,
        //         amount,
        //         component.calculations
        //     );
        //     await this.prisma.payrollComponent.update({
        //         where: { id: component.id },
        //         data: {
        //             amount: amount,
        //             monthlyAmount,
        //             annualAmount
        //         },
        //     });
        //     //Calculate and update payroll totals
        //     return this.recalculatePayrollTotals(payrollId);
        // } catch (error) {
        //     if (error instanceof BadRequestException ||
        //         error instanceof NotFoundException ||
        //         error instanceof ConflictException) {
        //         throw error;
        //     }
        //     throw new BadRequestException('Failed to update static component:' + error.message);
        // }
    }

    async findAllPayroll(skip = 0, take = 10) {
        try {
            const [payrolls, total] = await Promise.all([
                this.prisma.payroll.findMany({
                    skip,
                    take,
                    include: {
                        component: true,
                        user: {
                            select: {
                                id: true,
                                eId: true,
                                firstName: true,
                                lastName: true,
                                jobType: true
                            },
                        },
                    },
                    orderBy: { createdAt: 'desc' },
                }),
                this.prisma.payroll.count()
            ]);
            return {
                data: payrolls,
                total,
                hasMore: skip + take < total,
            };
        } catch (error) {
            if (error instanceof BadRequestException ||
                error instanceof NotFoundException ||
                error instanceof ConflictException) {
                throw error;
            }
            throw new BadRequestException('Failed to find all payroll:' + error.message);
        }

    }

    async findOnePayroll(payrollId: string) {
        try {
            return await this.findPayroll(payrollId);
        } catch (error) {
            if (error instanceof BadRequestException ||
                error instanceof NotFoundException ||
                error instanceof ConflictException) {
                throw error;
            }
            throw new BadRequestException('Failed to find one payroll:' + error.message);
        }
    }

    async updatePayroll(payrollId: string, update: UpdatePayrollDto) {
        try {
            // 1️⃣ Fetch existing payroll
            const payroll = await this.findPayroll(payrollId);
            if (!payroll) throw new NotFoundException("Payroll not found");

            console.log(update, "update")
            // 2️⃣ Recalculate payroll values (reusing your existing logic)
            const {
                earningComponents,
                deductionComponents,
                earnings,
                deductions,
                taxableAmount,
            } = await this.calculatePayRoll({
                ...update,
                userId: payroll.userId,
            });

            const allComponents = [...earningComponents, ...deductionComponents];

            console.log(allComponents, "all components")

            // 3️⃣ Use a transaction to ensure data integrity
            const updatedPayroll = await this.prisma.$transaction(async (tx) => {
                // 🧹 Delete old payroll components first
                await tx.payrollComponent.deleteMany({
                    where: { payrollId },
                });

                // ♻️ Recreate new payroll components
                const newPayroll = await tx.payroll.update({
                    where: { id: payrollId },
                    data: {
                        salary: update.salary ?? payroll.salary,
                        gross: earnings?.gross ?? 0,
                        net: earnings?.net ?? 0,
                        deductions: deductions?.totalDeductions ?? 0,
                        tax: deductions?.tax ?? 0,
                        pension: deductions?.pension ?? 0,
                        taxableIncome: taxableAmount ?? 0,
                        taxStatus: TaxStatus.CALCULATED,
                        component: {
                            create: allComponents.map((a) => ({
                                ...a,
                                user: { connect: { id: payroll.userId } },
                            })),
                        },
                    },
                    include: {
                        component: true,
                        user: {
                            select: {
                                id: true,
                                eId: true,
                                firstName: true,
                                lastName: true,
                                jobType: true,
                            },
                        },
                    },
                });

                // 🧩 Handle any custom components separately (if needed)
                const customComponents = allComponents.filter(
                    (a) =>
                        a.category === ComponentCategory.CUSTOM_DEDUCTION ||
                        a.category === ComponentCategory.CUSTOM_EARNING,
                );

                for (const customComponent of customComponents) {
                    await tx.payrollComponent.create({
                        data: {
                            ...customComponent,
                            payroll: { connect: { id: newPayroll.id } },
                            user: { connect: { id: payroll.userId } },
                        },
                    });
                }

                return newPayroll;
            });

            return updatedPayroll;
        } catch (error) {
            if (
                error instanceof BadRequestException ||
                error instanceof NotFoundException ||
                error instanceof ConflictException
            ) {
                throw error;
            }
            console.error("Payroll update failed:", error);
            throw new BadRequestException(
                "Failed to update payroll: " + error.message,
            );
        }
    }



    //////////////////////////////////////// HELPER FUNCTIONS  /////////////////////////////


    private calculateComponentAmounts = (salary: number, component: AddComponentDto[]) => {
        return component.map(comp => {
            let monthlyAmount = 0;
            let annualAmount = 0;

            if (comp.calculations === SalaryCalculationType.PERCENTAGE) {
                monthlyAmount = (salary / 12) * (comp.amount / 100);
                annualAmount = salary * (comp.amount / 100);
            } else {
                const custom = comp.category === ComponentCategory.CUSTOM_DEDUCTION || comp.category === ComponentCategory.CUSTOM_EARNING
                monthlyAmount = custom ? comp.amount : comp.amount * 12;
                annualAmount = custom ? comp.amount * 12 : comp.amount;
            }

            return {
                ...comp,
                monthlyAmount,
                annualAmount
            };
        })
    }


    private async recalculatePayrollTotals(payrollId: string) {
        try {
            const payroll = await this.findPayroll(payrollId);
            //Recalculate Nigerian Taxes
            const taxResults = await this.calculateNigerianTaxes(payroll.component, payroll.gross);

            //Update tax related componenets
            await this.updateTaxComponents(payrollId, taxResults);

            //Recalculate totals
            let gross = 0;
            let deductions = 0;

            for (const component of payroll.component) {
                if (component.type === SalaryType.EARNING) {
                    gross += component.annualAmount;
                } else {
                    if (!['Pension Contribution', 'NHF Contribution', 'PAYE Tax'].includes(component.title)) {
                        deductions += component.annualAmount;
                    }
                }
            }

            //Tax related deductions
            deductions += taxResults.tax + taxResults.pension + taxResults.nhf;

            const net = gross - deductions;

            return this.prisma.payroll.update({
                where: { id: payrollId },
                data: {
                    gross,
                    deductions,
                    net,
                    tax: taxResults.tax,
                    cra: taxResults.cra,
                    taxableIncome: taxResults.taxableIncome,
                    pension: taxResults.pension,
                    nhf: taxResults.nhf,
                    laa: taxResults.laa,
                    taxStatus: TaxStatus.CALCULATED,
                },
                include: {
                    component: {
                        orderBy: [
                            { category: 'asc' },
                            { title: 'asc' }
                        ],
                    },
                    user: {
                        select: {
                            id: true,
                            firstName: true,
                            lastName: true,
                            eId: true,
                            jobType: true,
                        }
                    }
                }
            });
        } catch (error) {
            if (error instanceof BadRequestException ||
                error instanceof NotFoundException ||
                error instanceof ConflictException) {
                throw error;
            }
            throw new BadRequestException('Failed to recalculate payroll totals:' + error.message);
        }

    }

    private async updateTaxComponents(payrollId: string, taxResults: any) {
        try {
            const payroll = await this.findPayroll(payrollId);
            //Update or create tax component
            const taxComponentTitles = ['Pension Contribution', 'NHF Contribution', 'PAYE Tax'];
            const taxComponents = [
                { title: 'Pension Contribution', amount: taxResults.pension },
                { title: 'NHF Contribution', amount: taxResults.nhf },
                { title: 'PAYE Tax', amount: taxResults.tax },
            ];
            for (const taxComp of taxComponents) {
                const existingComponent = payroll.component.find(comp => comp.title === taxComp.title);
                if (existingComponent) {
                    //Update existing tax component
                    await this.prisma.payrollComponent.update({
                        where: { id: existingComponent.id },
                        data: {
                            monthlyAmount: taxComp.amount / 12,
                            annualAmount: taxComp.amount
                        },
                    });
                } else {
                    //Create new tax component
                    await this.prisma.payrollComponent.create({
                        data: {
                            title: taxComp.title,
                            type: SalaryType.DEDUCTION,
                            category: ComponentCategory.STATIC_DEDUCTION,
                            calculations: SalaryCalculationType.FIXED,
                            amount: taxComp.amount / 12,
                            monthlyAmount: taxComp.amount / 12,
                            annualAmount: taxComp.amount,
                            payrollId,
                        },
                    });
                }
            }
        } catch (error) {
            if (error instanceof BadRequestException ||
                error instanceof NotFoundException ||
                error instanceof ConflictException) {
                throw error;
            }
            throw new BadRequestException('Failed to update tax components:' + error.message);
        }
    }

    private async calculateNigerianTaxes(components: any[], gross: number) {
        try {
            //Extract basic, housing, and transport componenets for tax calculations
            const basicComponent = components.find(c => c.title === 'Basic');
            const housingComponent = components.find(c => c.title === 'Housing');
            const transportComponent = components.find(c => c.title === 'Transport');

            //Extract life assurance component if exists
            const lifeAssuranceComponent = components.find(c =>
                c.title.toLowerCase().includes('life') &&
                c.title.toLowerCase('assurance')
            );

            const basic = basicComponent?.annualAmount || 0;
            const housing = housingComponent?.annualAmount || 0;
            const transport = transportComponent?.annualAmount || 0;
            const lifeAssurance = lifeAssuranceComponent?.annualAmount || 0;

            return this.taxService.calculateTotalTax(
                gross,
                basic,
                housing,
                transport,
                lifeAssurance
            );
        } catch (error) {
            if (error instanceof BadRequestException ||
                error instanceof NotFoundException ||
                error instanceof ConflictException) {
                throw error;
            }
            throw new BadRequestException('Failed to calculate nigerian taxes:' + error.message);
        }

    }

    private async findPayroll(payrollId: string) {
        try {
            const payroll = await this.prisma.payroll.findUnique({
                where: { id: payrollId },
                include: {
                    component: true,
                    user: {
                        select: {
                            id: true,
                            eId: true,
                            firstName: true,
                            lastName: true,
                            jobType: true,
                            email: true,
                        },
                    },
                },
            });
            if (!payroll) {
                throw bad("Payroll Not Found");
            }
            return payroll;
        } catch (error) {
            if (error instanceof BadRequestException ||
                error instanceof NotFoundException ||
                error instanceof ConflictException) {
                throw error;
            }
            throw new BadRequestException('Failed to find payroll:' + error.message);
        }
    }

}

