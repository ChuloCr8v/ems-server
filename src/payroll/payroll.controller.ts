import { Body, Controller, Delete, Get, Param, Patch, Post, Put, Res } from '@nestjs/common';
import { PayrollService } from './payroll.service';
import { AddComponentDto, PayrollDto, UpdatePayrollDto } from './dto/payroll.dto';
import { Response } from 'express';

@Controller('payroll')
export class PayrollController {
  constructor(private readonly payroll: PayrollService) { }
  @Post()
  async createPayroll(@Body() data: PayrollDto) {
    return await this.payroll.createPayroll(data);
  }

  @Get('payslips')
  async listPayslips() {
    return this.payroll.listPayslips();
  }

  @Put("calculate")
  calculatePayroll(@Body() data: PayrollDto) {
    return this.payroll.calculatePayRoll(data);
  }

  @Get("deductions")
  listDeductions() {
    return this.payroll.listDeductions();
  }

  @Get()
  async findAllPayrolls(@Res() res: Response) {
    const payrolls = await this.payroll.findAllPayroll();
    return res.status(200).json(payrolls.data);
  }

  @Get(':payrollId')
  async findOnePayroll(@Param('payrollId') payrollId: string, @Res() res: Response) {
    const payroll = await this.payroll.findOnePayroll(payrollId);
    return res.status(200).json(payroll);
  }


  @Patch(':payrollId')
  async updatePayroll(@Param('payrollId') payrollId: string, @Body() update: UpdatePayrollDto, @Res() res: Response) {
    const payroll = await this.payroll.updatePayroll(payrollId, update);
    return res.status(200).json({ message: `Payroll Has Been Updated`, payroll });
  }

  @Post(':payrollId/custom-component')
  async createCustomComponent(@Param('payrollId') payrollId: string, @Body() data: AddComponentDto, @Res() res: Response) {
    const component = await this.payroll.createCustomComponent(payrollId, data);
    return res.status(200).json({ message: `A Custom Component Has Been Added`, component });
  }

  @Delete(':componentId')
  async removeCustomComponent(@Param('componentId') componentId: string, @Res() res: Response) {
    const component = await this.payroll.removeCustomComponent(componentId);
    return res.status(200).json({ message: `Custom Component Has Been Removed`, component });
  }


  @Post('generate')
  async generatePayslip() {
    return this.payroll.generatePayslips();
  }

  // @Post('generate/:userId')
  // async generatePayslipForUser(@Param('userId') userId: string) {
  //   return this.payroll.generatePayslipForUser(userId);
  // }

  @Get('download/:payslipId')
  async downloadPayslip(@Param('payslipId') payslipId: string, @Res() res: Response) {
    const pdfBuffer = await this.payroll.downloadPayslip(payslipId, res)
    return res.send(pdfBuffer);
  }

  @Get('deductions/download/:id')
  async downloadDeductionsExcel(@Param('id') id: string, @Res() res: Response): Promise<void> {
    return this.payroll.downloadDeductionsExcel(id, res);
  }

  //   @Get('test-simple/:userId')
  // async testSimplePayslip(@Param('userId') userId: string, @Res() res: Response) {
  //     try {
  //         const PDFDocument = await import('pdfkit');
  //         const doc = new PDFDocument();

  //         res.setHeader('Content-Type', 'application/pdf');
  //         res.setHeader('Content-Disposition', 'inline; filename="test.pdf"');

  //         doc.pipe(res);
  //         doc.fontSize(25).text('TEST PAYSLIP', 100, 100);
  //         doc.fontSize(12).text('This is a test PDF generated directly without Puppeteer', 100, 150);
  //         doc.end();

  //     } catch (error) {
  //         // this.logger.error('Simple PDF test failed:', error);
  //         throw error;
  //     }
  // }
}
