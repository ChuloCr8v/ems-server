import { Injectable } from '@nestjs/common';
import { PayrollComponent, Prisma } from '@prisma/client';
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
    payroll: Prisma.PayrollGetPayload<{
      include: {
        user: { include: { departments: true } };
        component: true;
      };
    }>,
    components: PayrollComponent[],
  ): string {
    const user = payroll.user;

    const templatePath = path.join(__dirname, 'templates', 'payslip.html');
    let html = fs.readFileSync(templatePath, 'utf8');

    const date = new Date().toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
    });

    const netToWords = this.toWords.convert(payroll.net / 12);

    const earnings = components.filter((c) => c.type === 'EARNING');
    const deductions = components.filter((c) => c.type === 'DEDUCTION');

    const totalEarnings = earnings.reduce((s, c) => s + c.monthlyAmount, 0);
    const totalDeductions = deductions.reduce((s, c) => s + c.monthlyAmount, 0);



    const tableRows = this.generateTableRows(earnings, deductions);

    const netPay = payroll.net
    const netMonthly = netPay / 12

    // console.log({ grossMonthly, netMonthly })

    // console.log(payroll.gross - payroll.deductions)
    // console.log({ gross: payroll.gross, deductions: payroll.deductions })
    // bad("wait")

    html = html
      .replace(/{{employeeName}}/g, `${user.firstName} ${user.lastName}`)
      .replace(/{{designation}}/g, user.jobType || 'Not Specified')
      .replace(/{{employeeId}}/g, user.eId || 'N/A')
      .replace(/{{payPeriod}}/g, date)
      .replace(/{{department}}/g, user.departments?.[0]?.name || 'N/A')
      .replace(/{{netPay}}/g, this.formatNumber(netMonthly))
      .replace(/{{netPayMonthly}}/g, this.formatNumber(netMonthly))
      .replace(/{{tableRows}}/g, tableRows)
      .replace(/{{grossEarnings}}/g, this.formatNumber(totalEarnings))
      .replace(/{{totalDeductions}}/g, this.formatNumber(totalDeductions))
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
    earnings: PayrollComponent[],
    deductions: PayrollComponent[],
  ): string {
    const max = Math.max(earnings.length, deductions.length);


    console.log({ earnings, deductions })

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
