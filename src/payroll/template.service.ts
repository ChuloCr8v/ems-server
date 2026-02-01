import { Injectable } from '@nestjs/common';
import { JobType, PayrollComponent, Payslip, PayslipComponent, Prisma } from '@prisma/client';
import { ToWords } from 'to-words';
import * as fs from 'fs';
import * as path from 'path';
import { bad } from 'src/utils/error.utils';

@Injectable()
export class PayslipTemplateService {
  private readonly toWords = new ToWords({
    localeCode: 'en-NG',
    converterOptions: { currency: true },
  });

  generateHTML(
    payslip: Prisma.PayslipGetPayload<{
      include: {
        user: { include: { departments: true } };
        components: true;
      };
    }>,
  ): string {
    const user = payslip.user;
    const components = payslip.components;

    const templatePath = fs.existsSync(
      path.join(
        process.cwd(),
        'dist',
        'src',
        'payroll',
        'templates',
        'payslip.html',
      ),
    )
      ? path.join(
        process.cwd(),
        'dist',
        'src',
        'payroll',
        'templates',
        'payslip.html',
      )
      : path.join(process.cwd(), 'src', 'payroll', 'templates', 'payslip.html');

    let html = fs.readFileSync(templatePath, 'utf8');

    const date = new Date().toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
    });

    const netToWords = this.toWords.convert(payslip.net / 12);

    const earnings = components.filter((c) => c.type === 'EARNING');
    const deductions = components.filter((c) => c.type === 'DEDUCTION');

    const totalEarnings = earnings.reduce((s, c) => s + c.monthlyAmount, 0);
    const totalDeductions = deductions.reduce((s, c) => s + c.monthlyAmount, 0);

    const tableRows = this.generateTableRows(earnings, deductions);

    const netPay = payslip.net;
    const netMonthly = netPay / 12;

    // console.log({ grossMonthly, netMonthly })

    // console.log(payroll.gross - payroll.deductions)
    // console.log({ gross: payroll.gross, deductions: payroll.deductions })
    // bad("wait")

    html = html
      .replace(/{{employeeName}}/g, `${user.firstName} ${user.lastName}`)
      .replace(
        /{{designation}}/g,
        user.jobType === JobType.FULL_TIME
          ? 'Full Time'
          : user.jobType === JobType.CONTRACT
            ? 'Contract'
            : user.jobType || 'Not Specified',
      )
      .replace(/{{employeeId}}/g, user.eId || 'N/A')
      .replace(/{{payPeriod}}/g, date)
      .replace(/{{department}}/g, user.departments?.[0]?.name || 'N/A')
      .replace(/{{netPay}}/g, this.formatNumber(netMonthly))
      .replace(/{{netPayMonthly}}/g, this.formatNumber(netMonthly))
      .replace(/{{earningsTable}}/g, tableRows)
      .replace(/{{grossTotal}}/g, this.formatNumber(totalEarnings))
      .replace(/{{deductionsTotal}}/g, this.formatNumber(totalDeductions))
      .replace(/{{netToWords}}/g, netToWords);

    return html;
  }

  private formatNumber(num: number): string {
    if (!num || isNaN(num)) return '0.00';
    return num.toLocaleString('en-NG', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }

  private generateTableRows(
    earnings: PayslipComponent[],
    deductions: PayslipComponent[],
  ): string {
    const max = Math.max(earnings.length, deductions.length);

    return Array.from({ length: max }, (_, i) => {
      const e = earnings[i];
      const d = deductions[i];
      const striped = i % 2 === 1 ? 'striped' : '';

      return `
        <div class="table-row ${striped}">
          <div class="table-cell">${e?.title ?? '---'}</div>
          <div class="table-cell right">${e ? `₦${this.formatNumber(e.monthlyAmount)}` : '---'}</div>

          <div class="table-cell">${d?.title ?? '---'}</div>
          <div class="table-cell right">${d ? `₦${this.formatNumber(d.monthlyAmount)}` : '---'}</div>
        </div>
      `;
    }).join('');
  }
}
