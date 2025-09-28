import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { bad } from 'src/utils/error.utils';
import { BankDto } from './bank.dto';

@Injectable()
export class BankService {
    constructor(private prisma: PrismaService) { }

    async createBankAccount(userId: string, data: BankDto) {
        try {
            const user = await this.prisma.bank.create({
                data: {
                    bankName: data.bankName,
                    accountName: data.accountName,
                    accountNumber: data.accountNumber,
                    user: {
                        connect: { id: userId },
                    },
                },
            });
            return user;
        } catch (error) {
            console.log(error);
            bad(error);
        }
    }
}
