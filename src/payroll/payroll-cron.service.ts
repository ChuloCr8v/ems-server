import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from 'src/prisma/prisma.service';
import { PayrollComponentStatus } from '@prisma/client';
import { addMonths, isBefore } from 'date-fns';

@Injectable()
export class PayrollCronService {
    private readonly logger = new Logger(PayrollCronService.name);

    constructor(private readonly prisma: PrismaService) { }

    @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT, {
        timeZone: 'Africa/Lagos',
    })
    async handlePayrollComponentExpiry() {
        this.logger.log('Payroll component expiry cron triggered...');

        try {
            const activeComponents = await this.prisma.payrollComponent.findMany({
                where: {
                    isActive: true,
                    status: PayrollComponentStatus.ACTIVE,
                    duration: { not: null },
                    startDate: { not: null },
                },
            });

            const now = new Date();
            let expiredCount = 0;

            for (const component of activeComponents) {
                // Assuming duration is in months
                const expiryDate = addMonths(component.startDate, component.duration);

                if (isBefore(expiryDate, now)) {
                    await this.prisma.payrollComponent.update({
                        where: { id: component.id },
                        data: {
                            isActive: false,
                            status: PayrollComponentStatus.EXPIRED,
                        },
                    });
                    expiredCount++;
                }
            }

            if (expiredCount > 0) {
                this.logger.log(`Payroll component expiry cron finished. Expired ${expiredCount} components.`);
            } else {
                this.logger.log('Payroll component expiry cron finished. No components expired today.');
            }
        } catch (error) {
            this.logger.error('Error during payroll component expiry cron:', error);
        }
    }
}
