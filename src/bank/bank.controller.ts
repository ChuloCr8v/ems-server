import { Body, Controller, Param, Post } from '@nestjs/common';
import { BankService } from './bank.service';
import { BankDto } from './bank.dto';

@Controller('bank')
export class BankController {

    constructor(private bank: BankService) { }

    @Post(":userId")
    async createBankAccount(@Param("userId") userId: string, @Body() body: BankDto) {
        return await this.bank.createBankAccount(userId, body)
    }
}
