import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service';
import { PayslipTemplateService } from './template.service';
import { PuppeteerService } from '../puppeteer/puppeteer.service';
import { Payroll, User } from '@prisma/client';
import { MailService } from 'src/mail/mail.service';
import { monthInWords } from 'src/utils/monthInWords';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PayslipGeneratedEvent } from 'src/events/payroll.event';

@Processor('payslips', { concurrency: 5 })   // ✔ QUEUE NAME
export class PayslipQueueProcessor extends WorkerHost {

    constructor(
        private readonly prisma: PrismaService,
        private readonly payslipTemplate: PayslipTemplateService,
        private readonly puppeteerService: PuppeteerService,
        private readonly mail: MailService,
        private readonly event: EventEmitter2,
    ) {
        super();
    }

    // MAIN HANDLER
    async process(job: Job<{ payrollId: string }>) {

        const { payrollId } = job.data;
        console.log("Generating payslip for payroll:", payrollId, job.queueName);

        // 1. Fetch payroll
        const payroll = await this.prisma.payroll.findUnique({
            where: { id: payrollId },
            include: {
                user: { include: { departments: true } },
                component: true,
            },
        });

        if (!payroll) {
            throw new Error(`Payroll not found: ${payrollId}`);
        }

        // 2. Build HTML
        const html = this.payslipTemplate.generateHTML(
            payroll,
            payroll.component,
        );

        // 3. Convert to PDF
        const pdfBuffer: Buffer = await this.puppeteerService.renderPdfFromHtml(html);

        // 4. Save
        await this.savePayslip(pdfBuffer, payroll, payroll.user);

        return { status: 'done', payrollId };
    }

    private async savePayslip(
        pdfBuffer: Buffer,
        payroll: Payroll,
        user: User
    ): Promise<void> {

        const date = new Date().toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
        });

        const pdfData = new Uint8Array(pdfBuffer);

        const currentMonth = new Date().toLocaleString('default', { month: 'long' }).toLowerCase();
        const year = new Date().getFullYear();

        await this.prisma.payslip.create({
            data: {
                data: pdfData,
                name: `${user.firstName} ${user.lastName} Payslip (${date})`,
                amount: payroll.net,
                userId: payroll.userId,
                payrollId: payroll.id,
                month: currentMonth,
                year: year,
            },
        });

        this.event.emit('payroll.generated', new PayslipGeneratedEvent(
            user.id,
            payroll.id,
            currentMonth,
            year
        ));
    }

    @OnWorkerEvent('completed')
    onCompleted(job: Job) {
        console.log(`✔ Payslip generated for job ${job.id}`);
    }

    @OnWorkerEvent('failed')
    onFailed(job: Job, err: any) {
        console.error(`❌ Payslip failed for job ${job.id}`, err);
    }
}
