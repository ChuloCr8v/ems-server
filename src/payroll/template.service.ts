// payslip-template.service.ts
import { Injectable } from '@nestjs/common';
import { Payroll, PayrollComponent, User } from '@prisma/client';
import { ToWords } from 'to-words';

@Injectable()
export class PayslipTemplateService {
  private readonly toWords = new ToWords({
    localeCode: 'en-NG',
    converterOptions: { currency: true },
  });

  generateHTML(payroll: Payroll, user: User, components: PayrollComponent[]): string {
    const date = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long' });
    const netToWords = this.toWords.convert(payroll.net);
    
    const earnings = components.filter(comp => comp.type === 'EARNING');
    const deductions = components.filter(comp => comp.type === 'DEDUCTION');
    
    const totalEarnings = earnings.reduce((sum, comp) => sum + comp.monthlyAmount, 0);
    const totalDeductions = deductions.reduce((sum, comp) => sum + comp.monthlyAmount, 0);

    return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Payslip - ${date}</title>
  <link href="https://fonts.googleapis.com/css2?family=Raleway:wght@400;500;600;700&display=swap" rel="stylesheet">
  <style>${this.getStyles()}</style>
</head>
<body>
  <div class="payslip-container">
    <div class="payslip-document">
      ${this.renderHeader()}
      ${this.renderTitle(date)}
      <div class="payslip-content">
        ${this.renderEmployeeSection(user, payroll)}
        ${this.renderEarningsTable(earnings, deductions, totalEarnings, totalDeductions)}
        ${this.renderNetPayableSection(payroll.net)}
        ${this.renderAmountInWords(netToWords)}
        ${this.renderFooter()}
      </div>
    </div>
  </div>
</body>
</html>`;
  }

  private getStyles(): string {
    return `*{margin:0;padding:0;box-sizing:border-box}body{font-family:Raleway,sans-serif;
    background:#f5f5f5;padding:20px}.payslip-container{min-height:100vh;
    background:#f5f5f5;padding:32px 16px}.payslip-document{max-width:900px;margin:0 auto;
    background:#fff;box-shadow:0 4px 12px rgba(0,0,0,0.08)}.payslip-header{background:#E7F5FA;
    padding:24px 32px;text-align:center}.company-logo{font-size:28px;font-weight:bold;
    color:#00bcd4;margin-bottom:4px;font-family:Arial,sans-serif;letter-spacing:0.05em}.company-name{font-size:18px;
    font-weight:700;color:#1a1a1a;margin-bottom:4px}.company-address{font-weight:500;font-size:13px;
    color:#1a1a1a}.payslip-title{padding:24px 0;text-align:center}.payslip-title h3{font-size:20px;font-weight:bold;
    color:#1a1a1a}.payslip-content{padding:32px;padding-top:0}.employee-section{display:flex;justify-content:space-between;
    align-items:start;margin-bottom:24px}.employee-details{display:flex;flex-direction:column;gap:8px}.detail-row{display:flex}.detail-label{width:144px;
    font-size:14px;font-weight:500;color:#1a1a1a}.detail-value{font-size:14px;font-weight:900;color:#1a1a1a}.net-pay-box{background:white;
    box-shadow:0 4px 10px rgba(0,0,0,0.3);border-radius:8px;height:95px;width:220px;padding-right:15px;padding-top:20px}.net-pay-label{font-size:12px;
    font-weight:bold;display:flex;justify-content:center;align-items:center;width:190px;height:30px;margin-left:15px;color:white;background:linear-gradient(150deg,#40b554,#0a96cc)!important;
    border-radius:4px 4px 0 0}.net-pay-amount{font-size:24px;font-weight:bold;display:flex;justify-content:center;padding-top:5px}.earnings-table{width:100%;border:1px solid #e0e0e0;
    border-bottom:none;border-radius:0;overflow:hidden;margin-bottom:0}.table-header{display:grid;grid-template-columns:1fr 1fr 1fr 1fr;
    background:linear-gradient(150deg,#40b554,#0a96cc)!important;color:white}.table-header-cell{padding:12px 16px;font-weight:600;
    font-size:14px;text-align:center}.table-row{display:grid;grid-template-columns:1fr 1fr 1fr 1fr;
    border-bottom:1px solid #e0e0e0}.table-row.striped{background:#f8f9fa}.table-row.totals{background:#f0f0f0}.table-row.totals .table-cell{font-weight:bold}.table-cell{padding:12px 16px;
    font-size:14px;color:#1a1a1a;text-align:center}.table-cell.right{text-align:center;font-weight:700}.net-payable-section{background:#f8f9fa;
    border:1px solid #e0e0e0;border-radius:0;padding:10px;margin-bottom:24px}.net-payable-content{display:flex;justify-content:space-between;
    align-items:center;padding-left:30px;padding-right:55px}.net-payable-label-group{display:flex;flex-direction:column}.net-payable-title{font-size:16px;font-weight:bold;
    color:#1a1a1a}.net-payable-subtitle{font-size:12px;color:#666}.net-payable-value{font-size:16px;
    font-weight:bold;color:#1a1a1a}.amount-words-section{margin-bottom:0;border-bottom:1px solid #e0e0e0;padding-bottom:10px}.amount-words-title{font-size:12px;font-weight:800;
    color:black;margin-bottom:8px;text-align:center}.amount-words-text{font-size:12px;text-align:center;color:#1a1a1a}.payslip-footer{text-align:center;font-size:12px;
    color:#666;padding-top:16px;margin-top:5px;background-color:#F9F9F9;padding-bottom:15px}.empty-cell{color:#999;font-style:italic}`;
  }

  private renderHeader(): string {
    return `
<header class="payslip-header">
  <div class="company-logo">ZORACOM</div>
  <h2 class="company-name">Zora Communication Limited</h2>
  <p class="company-address">
    25 Bafaj Crescent, Ogunfayo, Lekki-Epe Expressway, Lagos State, Nigeria
  </p>
</header>`;
  }

  private renderTitle(date: string): string {
    return `
<div class="payslip-title">
  <h3>${date} Payslip</h3>
</div>`;
  }

  private renderEmployeeSection(user: User, payroll: Payroll): string {
    return `
<div class="employee-section">
  <div class="employee-details">
    <div class="detail-row">
      <span class="detail-label">Employee Name:</span>
      <span class="detail-value">${user.firstName} ${user.lastName}</span>
    </div>
    <div class="detail-row">
      <span class="detail-label">Designation:</span>
      <span class="detail-value">${user.jobType || 'Not Specified'}</span>
    </div>
    <div class="detail-row">
      <span class="detail-label">Employee ID:</span>
      <span class="detail-value">${user.eId || 'N/A'}</span>
    </div>
    <div class="detail-row">
      <span class="detail-label">Pay Period:</span>
      <span class="detail-value">${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long' })}</span>
    </div>
    <div class="detail-row">
      <span class="detail-label">Department:</span>
      <span class="detail-value">${user.departmentId || 'N/A'}</span>
    </div>
  </div>
  <div class="net-pay-box">
    <div class="net-pay-label">Employee Net Pay</div>
    <div class="net-pay-amount">₦${this.formatNumber(payroll.net)}</div>
  </div>
</div>`;
  }

  private renderEarningsTable(earnings: PayrollComponent[], deductions: PayrollComponent[], totalEarnings: number, totalDeductions: number): string {
    const rows = this.generateTableRows(earnings, deductions);
    
    return `
<div class="earnings-table">
  <div class="table-header">
    <div class="table-header-cell">Earnings</div>
    <div class="table-header-cell right">Amount</div>
    <div class="table-header-cell">Deductions</div>
    <div class="table-header-cell right">Amount</div>
  </div>
  ${rows}
  <div class="table-row totals">
    <div class="table-cell">Gross Earnings</div>
    <div class="table-cell right">₦${this.formatNumber(totalEarnings)}</div>
    <div class="table-cell">Total Deductions</div>
    <div class="table-cell right">₦${this.formatNumber(totalDeductions)}</div>
  </div>
</div>`;
  }

  private generateTableRows(earnings: PayrollComponent[], deductions: PayrollComponent[]): string {
    const maxRows = Math.max(earnings.length, deductions.length);
    return Array.from({ length: maxRows }, (_, i) => {
      const earning = earnings[i];
      const deduction = deductions[i];
      const isStriped = i % 2 === 1;
      
      return `
<div class="table-row ${isStriped ? 'striped' : ''}">
  <div class="table-cell">${earning?.title || '---'}</div>
  <div class="table-cell right">${earning ? `₦${this.formatNumber(earning.monthlyAmount)}` : '---'}</div>
  <div class="table-cell">${deduction?.title || '---'}</div>
  <div class="table-cell right">${deduction ? `₦${this.formatNumber(deduction.monthlyAmount)}` : '---'}</div>
</div>`;
    }).join('');
  }

  private renderNetPayableSection(netPay: number): string {
    return `
<div class="net-payable-section">
  <div class="net-payable-content">
    <div class="net-payable-label-group">
      <div class="net-payable-title">Total Net Payable</div>
      <div class="net-payable-subtitle">Gross Earnings - Total Deductions</div>
    </div>
    <div class="net-payable-value">₦${this.formatNumber(netPay)}</div>
  </div>
</div>`;
  }

  private renderAmountInWords(netToWords: string): string {
    return `
<div class="amount-words-section">
  <div class="amount-words-title">Amount in Words</div>
  <div class="amount-words-text">${netToWords}</div>
</div>`;
  }

  private renderFooter(): string {
    return `
<div class="payslip-footer">
  This document has been automatically generated by Miro Payroll, No signature is required
</div>`;
  }

  private formatNumber(num: number): string {
    if (typeof num !== 'number' || isNaN(num)) return '0';
    return num.toFixed(2).replace(/\d(?=(\d{3})+\.)/g, '$&,');
  }
}