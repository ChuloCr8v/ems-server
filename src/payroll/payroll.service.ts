import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { STATIC_DEDUCTION_COMPONENTS, STATIC_EARNING_COMPONENTS } from 'src/constants/static-components';
import { ComponentCategory, Payroll, PayrollComponent, SalaryCalculationType, SalaryType, TaxStatus, User } from '@prisma/client';
import { AddComponentDto, PayrollDto, UpdatePayrollDto } from './dto/payroll.dto';
import { bad } from 'src/utils/error.utils';
import { TaxService } from './tax.service';
import puppeteer, { Browser } from 'puppeteer';
import { resolve } from 'path';
import { ToWords } from 'to-words';
import { getMonthDateRange } from 'src/utils/getMonthDateRange';
import { PayslipTemplateService } from './template.service';
import { format } from 'date-fns';
import { formatNumberWithCommas } from 'src/utils/numberFormatter';
// import { ToWords } from 'to-words';

const templates = resolve(__dirname, 'templates');
import { Logger } from '@nestjs/common';

@Injectable()
export class PayrollService {
    private readonly logger = new Logger(PayrollService.name);
    private readonly payslipUrl = 'file://' + resolve(templates, 'payslip.html');
    private readonly towords = new ToWords({
        localeCode: 'en-NG',
        converterOptions: {
            currency: true,
        },
    });
    constructor(
        private readonly prisma: PrismaService, 
        private readonly taxService: TaxService,
        private readonly payslipTemplate: PayslipTemplateService
    ) {}

    async createPayroll(data: PayrollDto) {
        try {
            const { userId, salary } = data;

        //Check if user already has a payroll
        const existingPayroll = await this.prisma.payroll.findUnique({
            where: { userId },
        });
        if(existingPayroll) {
            throw bad("User already has a payroll");
        }

        //Create payroll with static components
        const { gross, net, deductions, components } = await this.createStaticComponents(salary);

        //Calculate Nigerian taxes
        const taxResults = await this.calculateNigerianTaxes(components, gross);

        return this.prisma.payroll.create({
            data: {
                salary,
                gross,
                net: net - taxResults.tax - taxResults.pension - taxResults.nhf,
                deductions: deductions + taxResults.tax - taxResults.pension - taxResults.nhf,
                tax: taxResults.tax,
                cra: taxResults.cra,
                pension: taxResults.pension,
                taxableIncome: taxResults.taxableIncome,
                nhf: taxResults.nhf,
                laa: taxResults.laa,
                taxStatus: TaxStatus.CALCULATED,
                user: { connect: { id: userId } },
                component: {
                    create: [
                        ...components,
                        //Pension
                        {
                            amount: taxResults.pension / 12,
                            type: SalaryType.DEDUCTION,
                            category: ComponentCategory.STATIC_DEDUCTION,
                            title: 'Pension Contribution',
                            calculations: SalaryCalculationType.FIXED,
                            monthlyAmount: taxResults.pension / 12,
                            annualAmount: taxResults.pension,
                        },
                        //NHF
                         {
                            amount: taxResults.nhf / 12,
                            type: SalaryType.DEDUCTION,
                            category: ComponentCategory.STATIC_DEDUCTION,
                            title: 'NHF Contribution',
                            calculations: SalaryCalculationType.FIXED,
                            monthlyAmount: taxResults.nhf / 12,
                            annualAmount: taxResults.nhf,
                        },
                        //PAYE Tax
                         {
                            amount: taxResults.tax / 12,
                            type: SalaryType.DEDUCTION,
                            category: ComponentCategory.STATIC_DEDUCTION,
                            title: 'PAYE Tax',
                            calculations: SalaryCalculationType.FIXED,
                            monthlyAmount: taxResults.tax / 12,
                            annualAmount: taxResults.tax,
                        },
                    ],
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
                        jobType: true
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
                throw new BadRequestException('Failed to create payroll:' + error.message);
        }
        
    }

    async createStaticComponents(
        salary: number, existingComponents?: any[]
    ): Promise<{ gross: number, net: number, deductions: number, components: any[] }>{
        // console.log('createStaticComponents called with salary:', salary);
        // console.log('existingComponents:', existingComponents);
        try {
            let gross = 0;
            let deductions = 0;
            const components = [];

        //Use existing components if provided, otherwise create new ones
        const staticEarningComponents = existingComponents
        ? existingComponents.filter(comp => comp.type === SalaryType.EARNING)
        : STATIC_EARNING_COMPONENTS.map(comp => ({
            amount: comp.amount,
            type: comp.type,
            category: comp.category,
            title: comp.title,
            calculations: comp.calculations,
            monthlyAmount: this.calculateComponentAmounts(salary, comp.amount, comp.calculations).monthlyAmount,
            annualAmount: this.calculateComponentAmounts(salary, comp.amount, comp.calculations).annualAmount,
        }));

        const staticDeductionComponents = existingComponents
        ? existingComponents.filter(comp => comp.type === SalaryType.DEDUCTION)
        : STATIC_DEDUCTION_COMPONENTS.map(comp => ({
            amount: comp.amount,
            type: comp.type,
            title: comp.title,
            category: comp.category,
            calculations: comp.calculations,
            monthlyAmount: this.calculateComponentAmounts( salary, comp.amount, comp.calculations).monthlyAmount,
            annualAmount: this.calculateComponentAmounts(salary, comp.amount, comp.calculations).annualAmount,
        }));

        //Add static earnings components
        for(const component of staticEarningComponents) {
            components.push(component);
                gross += component.annualAmount;
        }
        //Add static deduction components
        for(const component of staticDeductionComponents) {
            if (!['Pension Contribution', 'NHF Contribution', 'PAYE Tax'].includes(component.title)) {
            components.push(component);
            deductions += component.annualAmount;
         }
    }
        const net = gross - deductions;

        return { gross, deductions, net, components };
        } catch (error) {
             if (error instanceof BadRequestException || 
                      error instanceof NotFoundException || 
                      error instanceof ConflictException) {
                    throw error;
                }
                throw new BadRequestException('Failed to create static component:' + error.message);
        }
        
    }

    async createCustomComponent(payrollId: string, data: AddComponentDto) {
        try {
            const payroll = await this.findPayroll(payrollId);
            //Find component category based on salary type
            const category = data.type === SalaryType.EARNING
            ? ComponentCategory.CUSTOM_EARNING
            : ComponentCategory.CUSTOM_DEDUCTION;

            //Calculate component amounts
            const { monthlyAmount, annualAmount } = this.calculateComponentAmounts(
                payroll.salary,
                data.amount,
                data.calculations
            );


            //Create the custom component
            await this.prisma.payrollComponent.create({
                data: {
                    ...data,
                    category,
                    monthlyAmount,
                    annualAmount,
                    payrollId
                },
            });

            //Recalculate and update payroll totals
            return this.recalculatePayrollTotals(payrollId);
        } catch (error) {
            if (error instanceof BadRequestException || 
                      error instanceof NotFoundException || 
                      error instanceof ConflictException) {
                    throw error;
                }
                throw new BadRequestException('Failed to create custom component:' + error.message);
        }  
    }

    async removeCustomComponent(id: string) {
        try {
            const component = await this.prisma.payrollComponent.findUnique({
            where: { id },
            include: { payroll: true }
         });
            if(!component) {
                throw bad("Component Not Found");
         }

        //Only allow removal of custom components
        if(component.category !== ComponentCategory.CUSTOM_EARNING &&
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

    async updateStaticComponent(payrollId: string, title: string, amount: number){
        try {
            const payroll = await this.findPayroll(payrollId);
            //Find the static component
            const component = payroll.component.find(
                comp => comp.title === title &&
                (comp.category === ComponentCategory.STATIC_EARNING ||
                comp.category === ComponentCategory.STATIC_DEDUCTION)
            );

            if(!component) {
                throw bad("Static Component Not Found");
            }
            //Update the component amount and recalculate amounts
            const { monthlyAmount, annualAmount } = this.calculateComponentAmounts(
                payroll.salary,
                amount,
                component.calculations
            );
            await this.prisma.payrollComponent.update({
                where: {id: component.id },
                data: {
                    amount: amount,
                    monthlyAmount,
                    annualAmount
                },
            });
            //Calculate and update payroll totals
            return this.recalculatePayrollTotals(payrollId);
        } catch (error) {
            if (error instanceof BadRequestException || 
                      error instanceof NotFoundException || 
                      error instanceof ConflictException) {
                    throw error;
                  }
                  throw new BadRequestException('Failed to update static component:' + error.message);
        }
    }

    async findAllPayroll(skip = 0, take = 10) {
        try {
             const [payrolls, total] = await Promise.all([
            this.prisma.payroll.findMany({
                skip,
                take,
                include: {
                    component: true,
                    user: { select: {
                        id: true,
                        eId: true,
                        firstName: true,
                        lastName: true,
                        jobType: true
                    }, }, 
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
            const { salary } = update;
            const payroll = await this.findPayroll(payrollId);

            // console.log('Original salary:', payroll.salary, 'New salary:', salary);

            //Get static components (excluding tax related components)
            const existingStaticComponents = payroll.component.filter(comp => 
                comp.category === ComponentCategory.STATIC_EARNING ||
                comp.category === ComponentCategory.STATIC_DEDUCTION
            ).filter(comp => 
                !['Pension Contribution', 'NHF Contribution', 'PAYE Tax'].includes(comp.title)
            );

            // console.log('Found', existingStaticComponents.length, 'static components to update');
            let gross = 0;
            let deductions = 0;

            //Recalculate static component amounts based on new salary
            // const { gross, deductions, net, components } = await this.createStaticComponents(salary, existingStaticComponents);

            for(const component of existingStaticComponents) {
                const { monthlyAmount, annualAmount } = this.calculateComponentAmounts(
                    salary,
                    component.amount,
                    component.calculations
                );
                // console.log('Updating:', component.title, 'Old annual:', component.annualAmount, 'New annual:', annualAmount);

                //Update the component in the database
                await this.prisma.payrollComponent.update({
                    where: { id: component.id },
                    data: {
                        monthlyAmount,
                        annualAmount
                    },
                });

                //Acumulate totals
                if(component.type === SalaryType.EARNING) {
                    gross += annualAmount;
                } else {
                    deductions += annualAmount;
                }
            }

            const net = gross - deductions;
            //   console.log('New totals - Gross:', gross, 'Deductions:', deductions, 'Net:', net);

            const updatedComponents = await this.prisma.payrollComponent.findMany({
                where: { payrollId }
            });

            //Calculate Niogerian taxes with new salary and components
            const taxResults = await this.calculateNigerianTaxes(updatedComponents, gross);

            // Delete only tax components
            await this.prisma.payrollComponent.deleteMany({
                where: { 
                    payrollId,
                    title: {
                        in: ['Pension Contribution', 'NHF Contribution', 'PAYE Tax']
                    }
                }
            });
            //Create new tax component with updated values
            await this.prisma.payrollComponent.createMany({
                data: [
                    {
                    amount: taxResults.pension / 12,
                    type: SalaryType.DEDUCTION,
                    category: ComponentCategory.STATIC_DEDUCTION,
                    title: 'Pension Contribution',
                    calculations: SalaryCalculationType.FIXED,
                    monthlyAmount: taxResults.pension / 12,
                    annualAmount: taxResults.pension,
                    payrollId,
                },
                {
                    amount: taxResults.nhf / 12,
                    type: SalaryType.DEDUCTION,
                    category: ComponentCategory.STATIC_DEDUCTION,
                    title: 'NHF Contribution',
                    calculations: SalaryCalculationType.FIXED,
                    monthlyAmount: taxResults.nhf / 12,
                    annualAmount: taxResults.nhf,
                    payrollId,
                },
                {
                    amount: taxResults.tax / 12,
                    type: SalaryType.DEDUCTION,
                    category: ComponentCategory.STATIC_DEDUCTION,
                    title: 'PAYE Tax',
                    calculations: SalaryCalculationType.FIXED,
                    monthlyAmount: taxResults.tax / 12,
                    annualAmount: taxResults.tax,
                    payrollId,
                },
              ],
            });

            //Update the payroll with new totals
            return this.prisma.payroll.update({
                where:{ id: payrollId },
                data: {
                    salary,
                    gross,
                    net: net - taxResults.tax - taxResults.pension - taxResults.nhf,
                    deductions: deductions + taxResults.tax + taxResults.pension + taxResults.nhf,
                    tax: taxResults.tax,
                    cra: taxResults.cra,
                    taxableIncome: taxResults.taxableIncome,
                    nhf: taxResults.nhf,
                    laa: taxResults.laa,
                    taxStatus: TaxStatus.CALCULATED,
                },
                include: {
                    component: {
                        orderBy: [ { category: 'asc' }, { title: 'asc' } ], 
                    },
                    user: {
                        select: {
                            id: true,
                            eId: true,
                            firstName: true,
                            lastName: true,
                            jobType: true
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
                throw new BadRequestException('Failed to find update payroll:' + error.message);
        }
        
    }

    async generatePayslips(): Promise<{ success: boolean; message: string }> {
        try {
            const { start, end } = getMonthDateRange();
            //Check for existing payslips for the month
            const existingPayslip = await this.prisma.payslip.findFirst({
                where: {
                    createdAt: {
                        gte: start,
                        lte: end,
                    },
                },
            });
            if (existingPayslip) {
                throw bad('Payslip have already been generated for this month');
            }

            //Get all payrolls
            const payrolls = await this.prisma.payroll.findMany({
                include: {
                    user: true,
                    component: true,
                },
            });
            if(payrolls.length === 0) {
                throw bad('No payrolls found to generate payslips');
            }
            //Generate payslip for each payroll
            const generatePromises = payrolls.map(payroll =>
                 this.generatePayslip(payroll, payroll.user, payroll.component)
            );

            await Promise.all(generatePromises);

            return { success: true, message: `Successfully generated ${payrolls.length} payslips` };
        } catch (error) {
            if (error instanceof BadRequestException || 
                      error instanceof NotFoundException || 
                      error instanceof ConflictException) {
                    throw error;
                }
                throw new BadRequestException('Failed to generate payslip:' + error.message);
        }
    }

    async generatePayslipForUser(userId: string): Promise<{ success: boolean; message: string }> {
        const payroll = await this.prisma.payroll.findFirst({
            where: { userId },
            include: {
                user: true,
                component: true,
            },
        });
        if(!payroll) {
            throw bad("Payroll not found for user");
        }
        await this.generatePayslip(payroll, payroll.user, payroll.component);
        return { success: true, message: `Payslip generated for ${payroll.user.firstName}` };
    }

    async getPayslips(userId?: string) {
        try {
            const where = userId ? { userId }: {};

            return this.prisma.payslip.findMany({
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
                orderBy: { createdAt: 'desc'}
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

    async downloadPayslip(payslipId: string, res: any): Promise<void> {
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


    //////////////////////////////////////// HELPER FUNCTIONS  /////////////////////////////

    private calculateComponentAmounts(
        salary: number, 
        amount: number, 
        calculation: SalaryCalculationType
    ) {
        let monthlyAmount = 0;
        let annualAmount = 0;

        if(calculation === SalaryCalculationType.PERCENTAGE) {
            monthlyAmount = (salary / 12) * (amount / 100);
            annualAmount = salary * (amount / 100);
        } else {
            monthlyAmount = amount;
            annualAmount = amount * 12;
        }

        return { monthlyAmount, annualAmount };
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

        for(const component of payroll.component) {
            if(component.type === SalaryType.EARNING){
                gross += component.annualAmount;
            } else {
                if(!['Pension Contribution', 'NHF Contribution', 'PAYE Tax'].includes(component.title)){
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
                user: { select: {
                    id: true,
                    firstName: true,
                    lastName: true,
                    eId: true,
                    jobType: true,
                }}
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
        for(const taxComp of taxComponents) {
            const existingComponent = payroll.component.find(comp => comp.title === taxComp.title);
            if(existingComponent) {
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

        const basic = basicComponent?.amount || 0;
        const housing = housingComponent?.amount || 0;
        const transport = transportComponent?.amount || 0;
        const lifeAssurance = lifeAssuranceComponent?.amount || 0;

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
                  user: { select: {
                    id: true,
                    eId: true,
                    firstName: true,
                    lastName: true,
                    jobType: true,
                    workEmail: true,
                    // departments: true,
                    departments: { select: { id: true}}
                }, }, 
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

  private async generatePayslip(payroll: Payroll, user: User, components: PayrollComponent[]): Promise<void> {
    const browser = await this.launchBrowser();
    
    try {
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

    } finally {
      await browser.close();
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
