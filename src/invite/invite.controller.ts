import { Controller, Post, Body, Query, UploadedFiles, UseInterceptors, Get, Param, Res, Put } from '@nestjs/common';
import { InviteService } from './invite.service';
import { FilesInterceptor } from '@nestjs/platform-express';
import { Auth } from 'src/auth/decorators/auth.decorator';
import { Role } from '@prisma/client';
import { Response } from 'express';
import { AcceptInviteDto, CreateProspectDto } from './dto/invite.dto';

@Controller('invite')
export class InviteController {
  constructor(private inviteService: InviteService) {}

  // @Auth([Role.ADMIN, Role.SUPERADMIN])
  @Post('send')
  @UseInterceptors(FilesInterceptor('uploads'))
  async create(@Body() input: CreateProspectDto, @UploadedFiles() uploads: Express.Multer.File[], @Res() res: Response) {
    const prospect = await this.inviteService.createProspect(input, uploads);
    return res.status(200).json({ message: `A New Prospect Has Been Added`, prospect});
  }

  @Put('accept')
  async acceptInvite(@Param('token') token: AcceptInviteDto, @Res() res: Response) {
    const prospect =  this.inviteService.acceptInvite(token);
    return res.status(200).json({ message: `Prospect has accepted the Invitation`, prospect});
  }

  @Get('prospect')
  async getAllProspects(@Res() res: Response) {
    const prospects = await this.inviteService.getAllProspects();
    return res.status(200).json({ message: `All Prospects`, prospects });
  }

//  @Post('accept')
// @UseInterceptors(FileFieldsInterceptor([
//   { name: 'contractLetter', maxCount: 1 },
//   { name: 'nda', maxCount: 1 },
//   { name: 'guarantorForm', maxCount: 1 },
// ]))
// async acceptInvite(
//   @Body() body: any,
//   @UploadedFiles() files: any,
// ) {
//   return this.inviteService.acceptInvite(body, files);
// }

//   @Post('accept')
//   @UseInterceptors(AnyFilesInterceptor())
//   async acceptInvite(
//     @UploadedFiles() files: Express.Multer.File[],
//     @Body() body: any
//   ) {
//     console.log('BODY:', body);
//     console.log('FILES:', files);
//      return {
//     statusCode: 201,
//     message: 'Invite accepted successfully',
//     data: {
//       body,
//       filesInfo: files.map(f => ({ originalname: f.originalname, size: f.size })),
//     },
//   }
// };


  // @Post('reject')
  // reject(@Query('token') token: string) {
  //   return this.inviteService.rejectInvite(token);
  // }
  // // ✅ Get all invites
  // @Auth([Role.ADMIN, Role.SUPERADMIN])
  // @Get()
  // findAll() {
  //   return this.inviteService.findAll();
  // }

  // // ✅ Get invite by ID
  // @Auth([Role.ADMIN, Role.SUPERADMIN])
  // @Get(':id')
  // findOne(@Param('id') id: string) {
  //   return this.inviteService.findOne(id);
  // }

}
