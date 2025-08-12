import { Module } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service'; // adjust path if needed
import { AssetsController } from './asset.controller';
import { AssetService } from './asset.service';

@Module({
  controllers: [AssetsController],
  providers: [AssetService, PrismaService],
})
export class AssetModule {}
