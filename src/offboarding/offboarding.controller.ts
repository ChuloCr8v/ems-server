import { Body, Get, Controller, Param, Patch, Post, Res, UploadedFiles, UseInterceptors } from '@nestjs/common';
import { OffboardingService } from './offboarding.service';
import { FilesInterceptor } from '@nestjs/platform-express';
import { InitiateExit, ReturnAsset } from './dto/offboarding.dto';
import { Response } from 'express';
import { Auth } from 'src/auth/decorators/auth.decorator';
import { Role } from '@prisma/client';

@Controller('offboarding')
export class OffboardingController {
  constructor(private readonly offboarding: OffboardingService) {}

  @Auth([Role.ADMIN, Role.ASSET_MANAGER])
  @Post('/:id')
  @UseInterceptors(FilesInterceptor('uploads'))
  async initiateExit(
    @Param('id') userId: string, 
    @Body() data: InitiateExit, 
    @UploadedFiles() uploads: Express.Multer.File[],
    @Res() res: Response,
  ) {
    const exit = await this.offboarding.initiateExit(userId, data, uploads);
    return res.status(200).json({ message: `User has initiated Offboarding`, exit});
  }
  @Auth([Role.USER])
  @Patch(':assetId/return')
  async returnAsset(
    @Param('assetId') assetId: string, 
    @Body() data: ReturnAsset,
    @Res() res: Response,
  ) {
    const asset = await this.offboarding.returnAsset(assetId, data);
    return res.status(200).json({ message: `Asset Has Been Returned, Awaiting Confimation From Facility`, asset});
  }

  @Auth([Role.USER])
  @Post(':offboardingId/return-assets')
  async checkAllAssetReturned(@Param('offboardingId') offboardingId: string,) {
    return this.offboarding.checkAllAssetReturned(offboardingId);
  }

  @Auth([Role.ADMIN, Role.ASSET_MANAGER])
  @Post(':offboardingId/approve-assets')
  async approveAllAssets(
    @Param('offboardingId') offboardingId: string, 
    @Body() data: { notes?: string}
  ) {
    return this.offboarding.approveAllReturnedAssets(offboardingId, data.notes);
  }

  
  @Get()
  async getAllOffboarding(){
    return await this.offboarding.getAllOffboarding();
  }
}