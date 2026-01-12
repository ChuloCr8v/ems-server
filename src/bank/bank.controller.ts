import { Body, Controller, Param, Patch, Post, UseInterceptors } from '@nestjs/common';
import { BankService } from './bank.service';
import { BankDto } from './bank.dto';
import { Auth } from 'src/auth/decorators/auth.decorator';

@Controller('bank')
export class BankController {

    constructor(private bank: BankService) { }

    @Auth(["ADMIN", "HR", "FACILITY"])
    @Post(":userId")
    async createBankAccount(@Param("userId") userId: string, @Body() body: BankDto) {
        return await this.bank.createBankAccount(userId, body)
    }
}
