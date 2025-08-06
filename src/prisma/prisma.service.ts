import { Injectable, OnModuleInit } from '@nestjs/common';
import { Prisma, PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit {
  async onModuleInit() {
    await this.$connect();
  }

   async beginTransaction<T>(callback: (prisma: Prisma.TransactionClient) => Promise<T>): Promise<T> {
        return this.$transaction(callback);
    }

   async onModuleDestroy() {
    await this.$disconnect();
  }

  
}
