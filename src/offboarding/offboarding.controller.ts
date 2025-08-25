import { Body, Get, Controller, Param, Patch, Post, Res, UploadedFiles, UseInterceptors, Req, Header, UploadedFile } from '@nestjs/common';
import { OffboardingService } from './offboarding.service';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import { DebtPaymentDto, InitiateExit, ReturnAsset } from './dto/offboarding.dto';
import { Response } from 'express';
import { Auth } from 'src/auth/decorators/auth.decorator';
import { Role } from '@prisma/client';
import { IAuthUser } from 'src/auth/dto/auth.dto';
import { join } from 'path';
import { createReadStream } from 'fs';

@Controller('offboarding')
export class OffboardingController {
  constructor(private readonly offboarding: OffboardingService) {}

  @Auth([Role.ADMIN, Role.ASSET_MANAGER])
  @Post(':id')
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
  
  @Auth([Role.ADMIN, Role.USER, Role.ASSET_MANAGER])
  @Post(':assignmentId/comment')
  @UseInterceptors(FilesInterceptor('uploads'))
  async commentOffboardingAsset(
    @Param('assignmentId') assignmentId: string,
    @Body() comments: string,
    @UploadedFiles() uploads: Express.Multer.File[],
    @Req() req: { user: IAuthUser },
    @Res() res: Response,
  ) {
    const report = await this.offboarding.commentOffboardingAsset(assignmentId, comments, req.user, uploads);
    return res.status(200).json({ message: `A Fault Has Been Reported With An Asset`, report });
  }

  @Auth([Role.ADMIN, Role.USER])
  @Patch(':assignmentId/upload-payment')
  @UseInterceptors(FilesInterceptor('uploads'))
  async assetPaymentReceipt(
    @Param('assignmentId') assignmentId: string,
    @Body() data: { notes?: string},
    @UploadedFiles() uploads: Express.Multer.File[],
    @Res() res: Response,
  ) {
    const payment = await this.offboarding.assetPaymentReceipt(assignmentId, uploads, data.notes);
    return res.status(200).json({ message: `A Payment Receipt Has Been Uploaded For An Asset`, payment });
  }

  @Auth([Role.ADMIN])
  @Patch(':assignmentId/approve-payment')
  async approveAssetPayment(
    @Param('assignmentId') assignmentId: string,
    @Res() res: Response,
  ) {
    const approve = await this.offboarding.approveAssetPayment(assignmentId);
    return res.status(200).json({ message: `The Payment For This Asset Has Been Approved`, approve });
  }

  @Get('handover-template')
  @Header('Content-Type', 'application/pdf')
  @Header('Content-Disposition', 'attachment; filename=handover.pdf')
  async downloadTemplate() {
    const templatePath = join(process.cwd(), 'src/templates/handover.pdf');
    return createReadStream(templatePath);
  }

  @Auth([Role.ADMIN, Role.USER])
  @Post(':offboardingId/handover')
  @UseInterceptors(FileInterceptor('upload'))
  async submitHandover(
    @Param('offboardingId') offboardingId: string,
    @UploadedFile() upload: Express.Multer.File,
    @Body() data: { notes?: string},
    @Res() res: Response
  ) {
    const handover = await this.offboarding.submitHandover(offboardingId, upload, data.notes);
    return res.status(200).json({ message: `The Handover Form Has Been Uploaded`, handover });
  }

  @Auth([Role.ADMIN, Role.USER, Role.MANAGER])
  @Post(':handoverId/comment')
  @UseInterceptors(FilesInterceptor('uploads'))
  async commentHandover(
    @Param('handoverId') handoverId: string,
    @Body() comments: string,
    @UploadedFiles() uploads: Express.Multer.File[],
    @Req() req: { user: IAuthUser },
    @Res() res: Response,
  ) {
    const handover = await this.offboarding.commentOffboardingAsset(handoverId, comments, req.user, uploads);
    return res.status(200).json({ message: `A Comment Has Been Passed On Th Handover Document`, handover });
  }

  @Patch(':handoverId/approve')
  async approveHandoverSub(
    @Param('handoverId') handoverId: string,
    @Req() req: { manager: IAuthUser },
    @Res() res: Response,
  ) {
    const approve = await this.offboarding.approveHandoverSub(handoverId, req.manager);
    return res.status(200).json({ message: `The Handing Over Has Been Approved`, approve });
  }

  @Auth([Role.ADMIN, Role.USER])
  @Post(':offboardingId/payments')
  @UseInterceptors(FilesInterceptor('upload'))
  async uploadPayment(
    @Param('offboardingId') offboardingId: string,
    @UploadedFiles() uploads: Express.Multer.File[],
    @Body() dto: DebtPaymentDto,
    @Req() req: { user: IAuthUser },
  ) {
    return this.offboarding.deptPayment(
      offboardingId,
      uploads,
      req.user,
      dto
    );
  }

  @Auth([Role.ADMIN, Role.USER])
  @Post(':paymentId/comment')
  @UseInterceptors(FilesInterceptor('uploads'))
  async commentDebtPayment(
    @Param('paymentId') paymentId: string,
    @UploadedFiles() uploads: Express.Multer.File[],
    @Body() comment: string,
    @Res() res: Response,
    @Req() req: { user: IAuthUser },
  ) {
    const payment = await this.offboarding.commentdebtPayment(paymentId, comment, req.user, uploads);
    return res.status(200).json({ message: `A comment has been made on the payment`, payment });
  }

  @Auth([Role.ADMIN])
  @Patch(':paymentId/approve')
  async approveDebtPayment(
    @Param('paymentId') paymentId: string,
    @Req() req: { admin: IAuthUser },
    @Res() res: Response,
  ) {
    const approve = await this.offboarding.approveDebtPayment(paymentId, req.admin);
    return res.status(200).json({ message: `The Payment For This Asset Has Been Approved`, approve });
  }


  @Get()
  async getAllOffboarding(){
    return await this.offboarding.getAllOffboarding();
  }
}