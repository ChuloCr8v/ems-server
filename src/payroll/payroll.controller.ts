import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Req,
  Res,
  StreamableFile,
} from '@nestjs/common';
import { PayrollService } from './payroll.service';
import {
  AddComponentDto,
  PayrollDto,
  UpdatePayrollDto,
} from './dto/payroll.dto';
import { Response } from 'express';
import { IAuthUser, ReqPayload } from 'src/auth/dto/auth.dto';
import { Auth, AuthUser } from 'src/auth/decorators/auth.decorator';
import { PrismaService } from 'src/prisma/prisma.service';

@Controller('payroll')
export class PayrollController {
  constructor(
    private readonly payroll: PayrollService,
    private readonly prisma: PrismaService,
  ) { }
  @Post()
  async createPayroll(@Body() data: PayrollDto) {
    return await this.payroll.createPayroll(data);
  }

  @Auth()
  @Get('payslips')
  async listPayslips(@AuthUser() req: IAuthUser) {
    return this.payroll.listPayslips(req.sub);
  }

  @Get('payslips/user')
  async listUserPayslips(@AuthUser() req: IAuthUser) {
    return this.payroll.listUserPayslips(req.sub);
  }

  @Put('calculate')
  calculatePayroll(@Body() data: PayrollDto) {
    return this.payroll.calculatePayRoll(data);
  }

  @Get('deductions')
  listDeductions() {
    return this.payroll.listDeductions();
  }

  @Get()
  async findAllPayrolls(@Res() res: Response) {
    const payrolls = await this.payroll.findAllPayroll();
    return res.status(200).json(payrolls.data);
  }

  @Get(':payrollId')
  async findOnePayroll(
    @Param('payrollId') payrollId: string,
    @Res() res: Response,
  ) {
    const payroll = await this.payroll.findOnePayroll(payrollId);
    return res.status(200).json(payroll);
  }

  @Patch(':payrollId')
  async updatePayroll(
    @Param('payrollId') payrollId: string,
    @Body() update: UpdatePayrollDto,
    @Res() res: Response,
  ) {
    const payroll = await this.payroll.updatePayroll(payrollId, update);
    return res
      .status(200)
      .json({ message: `Payroll Has Been Updated`, payroll });
  }

  @Post(':payrollId/custom-component')
  async createCustomComponent(
    @Param('payrollId') payrollId: string,
    @Body() data: AddComponentDto,
    @Res() res: Response,
  ) {
    const component = await this.payroll.createCustomComponent(payrollId, data);
    return res
      .status(200)
      .json({ message: `A Custom Component Has Been Added`, component });
  }

  @Delete(':componentId')
  async removeCustomComponent(
    @Param('componentId') componentId: string,
    @Res() res: Response,
  ) {
    const component = await this.payroll.removeCustomComponent(componentId);
    return res
      .status(200)
      .json({ message: `Custom Component Has Been Removed`, component });
  }

  @Auth(['ADMIN', 'HR', 'SUPERADMIN'])
  @Post('generate')
  async generatePayslipsForPeriod(@Req() req: ReqPayload, @Body() data: { month: number }) {
    return this.payroll.queuePayslipsForPeriod(req.user.id, data.month);
  }

  @Auth()
  @Get('download/:payslipId')
  downloadPayslip(
    @Param('payslipId') payslipId: string,
  ): Promise<StreamableFile> {
    return this.payroll.downloadPayslip(payslipId);
  }

  @Get('deductions/download/:id')
  async downloadDeductionsExcel(
    @Param('id') id: string,
    @Res() res: Response,
  ): Promise<void> {
    return this.payroll.downloadDeductionsExcel(id, res);
  }

  @Auth(['ADMIN', 'HR', 'SUPERADMIN'])
  @Delete('delete/payslip')
  async delete() {
    await this.prisma.payslip.deleteMany();
    return { message: 'successful' };
  }
}
