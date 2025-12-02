import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service';
import { PayslipTemplateService } from './template.service';
import { PuppeteerService } from '../puppeteer/puppeteer.service';
import { Payroll, User } from '@prisma/client';
import { MailService } from 'src/mail/mail.service';
import { monthInWords } from 'src/utils/monthInWords';

@Processor('payslips', { concurrency: 5 })   // ✔ QUEUE NAME
export class PayslipQueueProcessor extends WorkerHost {

    constructor(
        private readonly prisma: PrismaService,
        private readonly payslipTemplate: PayslipTemplateService,
        private readonly puppeteerService: PuppeteerService,
        private readonly mail: MailService,
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


        await this.mail.sendEmployeePayslipReadyMail({
            month: monthInWords + " " + new Date().getFullYear().toString(),
            date: new Date().getFullYear().toString(),
            email: user.email,
            name: user.firstName,
            dashboardUrl: "https://ems.miro.zoracom.com",
            attachment: {
                filename: `${user.firstName} ${user.lastName} Payslip (${date}).pdf`,
                content: pdfData,
                contentType: "application/pdf"
            }

        })

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
