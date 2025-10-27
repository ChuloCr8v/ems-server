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

  @Put("calculate")
  async calculatePayroll(@Body() data: PayrollDto) {
    return await this.payroll.calculatePayRoll(data);
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
}
