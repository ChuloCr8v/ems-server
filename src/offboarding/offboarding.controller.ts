import { Body, Controller, Param, Post, Res, UploadedFiles, UseInterceptors } from '@nestjs/common';
import { OffboardingService } from './offboarding.service';
import { FilesInterceptor } from '@nestjs/platform-express';
import { InitiateExit } from './dto/offboarding.dto';
import { Response } from 'express';

@Controller('offboarding')
export class OffboardingController {
  constructor(private readonly offboarding: OffboardingService) {}

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
    // return res.status(200).json({ message: `Offboarding has been initiated`, exit});
  }
}