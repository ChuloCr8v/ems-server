import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { STATIC_DEDUCTION_COMPONENTS, STATIC_EARNING_COMPONENTS } from 'src/constants/static-components';
import { AddComponentDto, PayrollDto, UpdatePayrollDto } from './dto/payroll.dto';
import { ComponentCategory, SalaryCalculationType, SalaryType, TaxStatus, Payroll, PayrollComponent, User, } from '@prisma/client';
import { CalculateComponentDto } from './dto/payroll.dto';
import { bad } from 'src/utils/error.utils';
import { TaxService } from './tax.service';


import { Logger } from '@nestjs/common';
import { endOfMonth, startOfMonth } from 'date-fns';
import { Response } from 'express';
import { PayslipTemplateService } from './template.service';

@Injectable()
export class PayrollService {
    private readonly logger = new Logger(PayrollService.name);

    constructor(
        private readonly prisma: PrismaService,
        private readonly taxService: TaxService,
        private readonly payslipTemplate: PayslipTemplateService
    ) { }

    async calculatePayRoll(data: PayrollDto) {
        try {
            const { salary } = data;

            const deductibleSalary = salary * 0.6;
            const pensionAmt = deductibleSalary * 0.08;
            const CRAmount = salary - pensionAmt;
            const reliefAmount = CRAmount * 0.2 + 200000;
            const taxableAmount = CRAmount - reliefAmount;

            const { gross, deductions, components } = this.calculatePayrollComponents(salary, data.components);

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

            // console.log("calcultation response", response)


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

            return createdPayroll;
        } catch (error) {
            console.log(error)
            bad(error)
        }
    }


    private calculatePayrollComponents(
        salary: number,
        existingComponents: AddComponentDto[]
    ): {
        gross: number;
        net: number;
        deductions: number;
        components: CalculateComponentDto[];
    } {
        if (!existingComponents) return;

        let gross = 0;
        let deductions = 0;
        const components: CalculateComponentDto[] = [];

        // calculate static earning/deduction components
        const staticEarningComponents = this.calculateComponentAmounts(
            salary,
            STATIC_EARNING_COMPONENTS
        );

        const staticDeductionComponents = this.calculateComponentAmounts(
            salary,
            STATIC_DEDUCTION_COMPONENTS
        );

        // filter custom earning/deduction components
        const customEarning = existingComponents?.filter(
            (e) =>
                e.category === ComponentCategory.CUSTOM_EARNING &&
                e.type === SalaryType.EARNING
        ) ?? [];

        const customDeduction = existingComponents?.filter(
            (e) =>
                e.category === ComponentCategory.CUSTOM_DEDUCTION &&
                e.type === SalaryType.DEDUCTION
        ) ?? [];

        // calculate custom earning/deduction components
        const customEarningComponents = this.calculateComponentAmounts(
            salary,
            customEarning
        );

        const customDeductionComponents = this.calculateComponentAmounts(
            salary,
            customDeduction
        );

        // merge and process earnings
        const allEarningComponents = [
            ...customEarningComponents,
            ...staticEarningComponents,
        ].map((component) => ({
            ...component,
            id: crypto.randomUUID(), // ✅ add unique id
        }));

        for (const component of allEarningComponents) {
            components.push(component);
            gross += component.annualAmount;
        }

        // merge and process deductions
        const excludedTitles = ["Pension Contribution", "NHF Contribution", "PAYE Tax"];
        const allDeductionComponents = [
            ...customDeductionComponents,
            ...staticDeductionComponents,
        ].map((component) => ({
            ...component,
            id: crypto.randomUUID(), // ✅ add unique id
        }));

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
            const payroll = await this.findPayroll(payrollId);
            if (!payroll) throw new NotFoundException("Payroll not found");

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

            const updatedPayroll = await this.prisma.$transaction(async (tx) => {
                await tx.payrollComponent.deleteMany({
                    where: { payrollId },
                });

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

    async listDeductions() {
        try {
            const deductions = await this.prisma.deductions.findMany({
                orderBy: {
                    createdAt: "desc",
                },
            });

            return deductions;
        } catch (error) {
            bad(error);
        }
    }

    private async generatePayslipPDFOnly(payroll: any): Promise<void> {
        const browser = await this.launchBrowser();

        try {
            // Since payroll includes user, we generate PDF for that single user
            const user = payroll.user;
            const components = payroll.component;

            const page = await browser.newPage();
            const html = this.payslipTemplate.generateHTML(payroll, user, components);

            await page.setContent(html, { waitUntil: 'networkidle0', timeout: 30000 });

            const pdfBuffer = await page.pdf({
                format: 'A4',
                printBackground: true,
                preferCSSPageSize: true,
                timeout: 30000,
            });

            this.validatePDFBuffer(pdfBuffer);
            await this.savePayslip(Buffer.from(pdfBuffer), payroll, user);
            await page.close();
        } finally {
            await browser.close();
        }
    }

    private async generateConsolidatedDeductionSummary(payrolls: Payroll[]): Promise<void> {
        const now = new Date();
        const month = now.getMonth() + 1;
        const year = now.getFullYear();
        const monthInWords = now.toLocaleDateString("en-US", { month: "long", year: "numeric" });

        const monthStart = startOfMonth(now);
        const monthEnd = endOfMonth(now);

        // === 1. Fetch all deductions for the month (across all payrolls)
        const comps = await this.prisma.payrollComponent.findMany({
            where: {
                payrollId: { in: payrolls.map((p) => p.id) },
                category: { in: ["STATIC_DEDUCTION"] },
                createdAt: { gte: monthStart, lte: monthEnd },
            },
            include: { user: true },
        });

        // === 2. Fetch all earnings (for employer pension calc)
        const earningComponents = await this.prisma.payrollComponent.findMany({
            where: {
                payrollId: { in: payrolls.map((p) => p.id) },
                category: { in: ["STATIC_EARNING"] },
                createdAt: { gte: monthStart, lte: monthEnd },
            },
            include: { user: true },
        });

        // === 3. Aggregate total tax + pension across company
        const tax = comps
            .filter((x) => x.title === "PAYE Tax")
            .reduce((total, item) => total + (item.monthlyAmount || 0), 0);

        const pension = comps
            .filter((x) => x.title === "Pension Contribution")
            .reduce((total, item) => total + (item.monthlyAmount || 0), 0);

        // === 4. Group data per employee
        const employeeMap = new Map<string, any>();

        // Employer pension (based on earnings)
        for (const earning of earningComponents) {
            const id = earning.user.eId;
            if (!employeeMap.has(id)) {
                employeeMap.set(id, {
                    employeeId: id,
                    employeeName: `${earning.user.firstName} ${earning.user.lastName}`,
                    tax: 0,
                    employeePension: 0,
                    employerPension: 0,
                    totalPension: 0,
                });
            }

            const emp = employeeMap.get(id);
            const title = earning.title.toLowerCase();
            if (["basic", "housing", "transport"].includes(title)) {
                emp.employerPension += 0.06 * (earning.monthlyAmount || 0);
            }
        }

        // Employee pension + tax deductions
        for (const c of comps) {
            const id = c.user.eId;
            if (!employeeMap.has(id)) {
                employeeMap.set(id, {
                    employeeId: id,
                    employeeName: `${c.user.firstName} ${c.user.lastName}`,
                    tax: 0,
                    employeePension: 0,
                    employerPension: 0,
                    totalPension: 0,
                });
            }

            const emp = employeeMap.get(id);
            if (c.title === "PAYE Tax") emp.tax = c.monthlyAmount || 0;
            if (c.title === "Pension Contribution") emp.employeePension = c.monthlyAmount || 0;

            emp.totalPension = (emp.employeePension || 0) + (emp.employerPension || 0);
        }

        const structuredData = Array.from(employeeMap.values());

        // === 5. Generate Excel file
        const excelBuffer = await this.generateDeductionsExcel({
            deductions: structuredData,
            month,
            year,
        });

        // === 6. Save deductions record
        await this.prisma.deductions.create({
            data: {
                name: `Deductions-${monthInWords}`,
                tax,
                pension,
                month: monthInWords,
                data: excelBuffer,
            },
        });
    }



    async generatePayslips(): Promise<{ success: boolean; message: string }> {
        try {
            const { start, end } = getMonthDateRange();

            // ✅ Check if payslips already exist for this month
            const existingPayslip = await this.prisma.payslip.findFirst({
                where: {
                    createdAt: {
                        gte: start,
                        lte: end,
                    },
                },
            });

            // if (existingPayslip) {
            //     throw new ConflictException('Payslips have already been generated for this month');
            // }

            // ✅ Fetch payrolls with related data
            const payrolls = await this.prisma.payroll.findMany({
                include: {
                    user: true,
                    component: true,
                },
            });

            if (!payrolls.length) {
                throw new NotFoundException('No payrolls found to generate payslips');
            }

            // ✅ Generate PDF payslips for each payroll (user)
            const results = await Promise.allSettled(
                payrolls.map(payroll => this.generatePayslipPDFOnly(payroll))
            );

            // ✅ Generate ONE consolidated deductions Excel for ALL users
            await this.generateConsolidatedDeductionSummary(payrolls);

            const successCount = results.filter(r => r.status === 'fulfilled').length;
            const failedCount = results.length - successCount;

            return {
                success: true,
                message: `Successfully generated ${successCount} payslips${failedCount ? ` (${failedCount} failed)` : ''}`,
            };
        } catch (error: any) {
            if (
                error instanceof BadRequestException ||
                error instanceof NotFoundException ||
                error instanceof ConflictException
            ) {
                throw error;
            }
            throw new BadRequestException(`Failed to generate payslips: ${error.message}`);
        }
    }

    // async generatePayslipForUser(userId: string): Promise<{ success: boolean; message: string }> {
    //     const payroll = await this.prisma.payroll.findFirst({
    //         where: { userId },
    //         include: {
    //             user: true,
    //             component: true,
    //         },
    //     });
    //     if (!payroll) {
    //         throw bad("Payroll not found for user");
    //     }
    //     await this.generatePayslip(payroll);
    //     return { success: true, message: `Payslip generated for ${payroll.user.firstName}` };
    // }

    async getPayslips(userId?: string) {
        try {
            const where = userId ? { userId } : {};

            return await this.prisma.payslip.findMany({
                where,
                include: {
                    user: {
                        select: {
                            id: true,
                            firstName: true,
                            lastName: true,
                            eId: true,
                        },
                    },
                },
                orderBy: { createdAt: 'desc' }
            })
        } catch (error) {
            if (error instanceof BadRequestException ||
                error instanceof NotFoundException ||
                error instanceof ConflictException) {
                throw error;
            }
            throw new BadRequestException('Failed to get payslip:' + error.message);
        }
    }

    async listPayslips() {
        try {
            return await this.prisma.payslip.findMany({
                include: {
                    user: true,
                },
                orderBy: {
                    createdAt: "desc"
                }
            })
        } catch (error) {
            console.log(error)
            bad(error)
        }
    }

    async downloadPayslip(payslipId: string, res: Response): Promise<void> {
        const payslip = await this.prisma.payslip.findUnique({
            where: { id: payslipId },
            include: { user: true },
        });

        if (!payslip) throw new NotFoundException('Payslip not found');

        // Convert Uint8Array to Buffer
        const pdfBuffer = Buffer.from(payslip.data);

        // Validate the PDF
        this.validatePDFBuffer(pdfBuffer);

        // Set response headers
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Length', pdfBuffer.length);
        res.setHeader('Content-Disposition', `attachment; filename="${payslip.name}.pdf"`);

        // Send the PDF buffer
        res.send(pdfBuffer);
    }

    async downloadDeductionsExcel(deductionId: string, res: Response): Promise<void> {
        const deduction = await this.prisma.deductions.findUnique({
            where: { id: deductionId },
        });

        if (!deduction || !deduction.data) {
            throw new NotFoundException('Deductions file not found');
        }

        const excelBuffer = Buffer.from(deduction.data);

        // Optional buffer check
        if (!excelBuffer || excelBuffer.length === 0) {
            throw new Error('Invalid Excel file buffer');
        }

        res.setHeader(
            'Content-Type',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        );
        res.setHeader('Content-Length', excelBuffer.length);
        res.setHeader('Content-Disposition', `attachment; filename="${deduction.name}.xlsx"`);

        res.send(excelBuffer);
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

    private async launchBrowser() {
        try {
            // Use the full puppeteer package instead of puppeteer-core
            const puppeteer = await import('puppeteer');

            const launchOptions: any = {
                headless: true, // Use true instead of 'shell' for better compatibility
                args: [
                    '--no-sandbox',
                    '--disable-setuid-sandbox',
                    '--disable-dev-shm-usage',
                    '--disable-accelerated-2d-canvas',
                    '--no-first-run',
                    '--no-zygote',
                    '--disable-gpu',
                    '--disable-web-security',
                    '--disable-features=VizDisplayCompositor'
                ],
                timeout: 30000,
            };

            // Try to find Chrome executable
            const possiblePaths = [
                process.env.CHROME_PATH,
                '/usr/bin/google-chrome',
                '/usr/bin/chromium-browser',
                'C:/Program Files/Google/Chrome/Application/chrome.exe',
                'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
            ];

            for (const path of possiblePaths) {
                if (path) {
                    try {
                        const fs = require('fs');
                        if (fs.existsSync(path)) {
                            launchOptions.executablePath = path;
                            this.logger.log(`Using Chrome at: ${path}`);
                            break;
                        }
                    } catch (error) {
                        // Continue to next path
                    }
                }
            }

            this.logger.log('Launching browser with options:', launchOptions);
            const browser = await puppeteer.launch(launchOptions);
            this.logger.log('Browser launched successfully');
            return browser;

        } catch (error) {
            this.logger.error('Browser launch failed:', error);

            // Fallback: try with different options
            try {
                const puppeteer = await import('puppeteer');
                const browser = await puppeteer.launch({
                    headless: true,
                    args: ['--no-sandbox', '--disable-setuid-sandbox']
                });
                return browser;
            } catch (fallbackError) {
                throw new Error(`All browser launch attempts failed: ${error.message}`);
            }
        }
    }

    private validatePDFBuffer(buffer: any): void {
        if (!buffer) {
            throw new Error('PDF buffer is null or undefined');
        }

        let pdfBuffer: Buffer;

        // Handle different buffer types
        if (Buffer.isBuffer(buffer)) {
            pdfBuffer = buffer;
        } else if (buffer instanceof Uint8Array) {
            pdfBuffer = Buffer.from(buffer);
        } else if (ArrayBuffer.isView(buffer)) {
            pdfBuffer = Buffer.from(buffer.buffer, buffer.byteOffset, buffer.byteLength);
        } else {
            throw new Error('Unsupported buffer type');
        }

        if (pdfBuffer.length === 0) {
            throw new Error('PDF buffer is empty');
        }

        // Check for PDF signature
        const header = pdfBuffer.subarray(0, 4).toString('ascii');
        if (header !== '%PDF') {
            throw new Error(`Invalid PDF format. Expected '%PDF', got '${header}'`);
        }
    }

    private async generateIndividualPayslip(browser: any, payroll: Payroll, user: any): Promise<void> {
        const components = await this.prisma.payrollComponent.findMany({
            where: {
                payrollId: payroll.id,
                userId: user.id,
            },
        });

        const page = await browser.newPage();
        const html = this.payslipTemplate.generateHTML(payroll, user, components);

        await page.setContent(html, { waitUntil: 'networkidle0', timeout: 30000 });

        const pdfBuffer = await page.pdf({
            format: 'A4',
            printBackground: true,
            preferCSSPageSize: true,
            timeout: 30000,
        });

        this.validatePDFBuffer(pdfBuffer);
        await this.savePayslip(Buffer.from(pdfBuffer), payroll, user);

        await page.close();
    }

    private async generateDeductionSummary(payroll: Payroll): Promise<void> {
        const now = new Date();
        const month = now.getMonth() + 1;
        const year = now.getFullYear();
        const monthInWords = now.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

        const monthStart = startOfMonth(now);
        const monthEnd = endOfMonth(now);

        // === 1. Get deductions (tax + pension)
        const comps = await this.prisma.payrollComponent.findMany({
            where: {
                payrollId: payroll.id,
                category: { in: ['STATIC_DEDUCTION'] },
                createdAt: { gte: monthStart, lte: monthEnd },
            },
            include: { user: true },
        });

        // === 2. Get earnings (for employer pension calc)
        const earningComponents = await this.prisma.payrollComponent.findMany({
            where: {
                payrollId: payroll.id,
                category: { in: ['STATIC_EARNING'] },
                createdAt: { gte: monthStart, lte: monthEnd },
            },
            include: { user: true },
        });

        // === 3. Aggregate totals across company
        const tax = comps
            .filter(x => x.title === 'PAYE Tax')
            .reduce((total, item) => total + (item.monthlyAmount || 0), 0);

        const pension = comps
            .filter(x => x.title === 'Pension Contribution')
            .reduce((total, item) => total + (item.monthlyAmount || 0), 0);

        // === 4. Group data per employee
        const employeeMap = new Map<string, any>();

        // First, calculate employer pension for each user based on their earnings
        for (const earning of earningComponents) {
            const id = earning.user.eId;

            if (!employeeMap.has(id)) {
                employeeMap.set(id, {
                    employeeId: id,
                    employeeName: `${earning.user.firstName} ${earning.user.lastName}`,
                    // monthInWords,
                    tax: 0,
                    employeePension: 0,
                    employerPension: 0,
                    totalPension: 0,
                });
            }


            const emp = employeeMap.get(id);

            // Normalize title matching
            const title = earning.title.toLowerCase();
            console.log(title)
            if (['basic', 'housing', 'transport'].includes(title)) {
                emp.employerPension += 0.6 * (earning.monthlyAmount || 0);
            }
        }

        // Then, add deductions (employee pension + tax)
        for (const c of comps) {
            const id = c.user.eId;

            if (!employeeMap.has(id)) {
                employeeMap.set(id, {
                    employeeId: id,
                    employeeName: `${c.user.firstName} ${c.user.lastName}`,
                    // monthInWords,
                    tax: 0,
                    employeePension: pension,
                    employerPension: 0,
                    totalPension: 0,
                });
            }

            const emp = employeeMap.get(id);

            if (c.title === 'PAYE Tax') emp.tax = c.monthlyAmount || 0;
            if (c.title === 'Pension Contribution') emp.employeePension = c.monthlyAmount || 0;

            // Compute total pension per employee
            emp.totalPension = (emp.employeePension || 0) + (emp.employerPension || 0);
        }

        const structuredData = Array.from(employeeMap.values());

        // === 5. Generate Excel and save
        const excelBuffer = await this.generateDeductionsExcel({
            deductions: structuredData,
            month,
            year,
        });

        await this.prisma.deductions.create({
            data: {
                name: `Deductions-${monthInWords}`,
                tax,
                pension,
                month: monthInWords,
                data: excelBuffer,
            },
        });
    }




    // private async generatePayslip(payroll: Payroll): Promise<void> {
    //     const browser = await this.launchBrowser();

    //     try {
    //         const users = await this.prisma.user.findMany({
    //             where: {
    //                 payroll: { is: { id: payroll.id } },
    //             },
    //         });


    //         for (const user of users) {
    //             await this.generateIndividualPayslip(browser, payroll, user);
    //         }

    //         // await this.generateDeductionSummary(payroll);

    //     } finally {
    //         await browser.close();
    //     }
    // }

    private async generateDeductionsExcel({
        deductions,
        month,
        year,
    }: {
        deductions: any[];
        month: number;
        year: number;
    }): Promise<Buffer> {
        try {
            const workbook = new ExcelJS.Workbook();
            const sheet = workbook.addWorksheet(`Deductions ${month}-${year}`);


            // Header row - FIXED: Match the data columns exactly
            sheet.addRow([
                "S/N",
                "Employee ID",
                "Employee Name",
                "Month",
                "PAYE (Tax) Amount (₦)",
                "Employer Pension (₦)",
                "Employee Pension (₦)",
                "Total Pension (₦)",
            ]);

            // Style header
            const headerRow = sheet.getRow(1);
            headerRow.font = { bold: true };
            headerRow.alignment = { horizontal: "center" };

            console.log("deductions", deductions)

            deductions.forEach((d, index) => {
                sheet.addRow([
                    index + 1,
                    d.employeeId,
                    d.employeeName,
                    d.monthInWords,
                    d.tax || 0,
                    d.employerPension || 0,
                    d.employeePension || 0,
                    d.totalPension || 0,
                ]);
            });

            sheet.columns = [
                { width: 6 },
                { width: 15 },
                { width: 40 },
                { width: 15 },
                { width: 20 },
                { width: 25 },
                { width: 25 },
                { width: 25 },
            ];

            // Style the amount columns as currency
            [5, 6, 7, 8].forEach(colIndex => { // Columns E and F (5th and 6th columns)
                sheet.getColumn(colIndex).numFmt = '#,##0.00';
            });

            // Generate Excel buffer
            const buffer = await workbook.xlsx.writeBuffer();
            return Buffer.from(buffer);
        } catch (error) {
            console.error("Error generating deductions Excel:", error);
            throw error;
        }
    }

    private async savePayslip(pdfBuffer: Buffer, payroll: Payroll, user: User): Promise<void> {
        const date = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long' });

        // Convert Buffer to Uint8Array for Prisma
        const pdfData = new Uint8Array(pdfBuffer);

        await this.prisma.payslip.create({
            data: {
                data: pdfData,
                name: `${user.firstName} ${user.lastName} Payslip (${date})`,
                amount: payroll.net,
                userId: payroll.userId,
                payrollId: payroll.id,
                month: new Date().getMonth() + 1,
                year: new Date().getFullYear(),
            },
        });
    }


    private prepareSectionsData(components: PayrollComponent[]): any[] {
        const earnings = components
            .filter(component => component.type === SalaryType.EARNING)
            .map(earning => ({
                ename: earning.title,
                evalue: earning.monthlyAmount
            }));

        const deductions = components
            .filter(component => component.type === SalaryType.DEDUCTION)
            .map(deduction => ({
                dname: deduction.title,
                dvalue: deduction.monthlyAmount
            }));

        const sectionsData: any[] = [];
        const maxLength = Math.max(earnings.length, deductions.length);

        for (let i = 0; i < maxLength; i++) {
            const earning = earnings[i];
            const deduction = deductions[i];
            sectionsData.push({
                ename: earning?.ename ?? '-',
                evalue: earning?.evalue ?? 0,
                dname: deduction?.dname ?? '-',
                dvalue: deduction?.dvalue ?? 0,
            });
        }

        return sectionsData;
    }

}

