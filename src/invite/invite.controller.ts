import { Controller, Post, Body, Query, UploadedFiles, UseInterceptors, Get, Param } from '@nestjs/common';
import { InviteService } from './invite.service';
import { AnyFilesInterceptor } from '@nestjs/platform-express';
import { Auth } from 'src/auth/decorators/auth.decorator';
import { Role } from '@prisma/client';

@Controller('invite')
export class InviteController {
  constructor(private inviteService: InviteService) {}

  @Auth([Role.ADMIN, Role.SUPERADMIN])
  @Post('send')
  send(@Body('email') email: string) {
    return this.inviteService.sendInvite(email);
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
  @Post('accept')
  @UseInterceptors(AnyFilesInterceptor())
  async acceptInvite(
    @UploadedFiles() files: Express.Multer.File[],
    @Body() body: any
  ) {
    console.log('BODY:', body);
    console.log('FILES:', files);
     return {
    statusCode: 201,
    message: 'Invite accepted successfully',
    data: {
      body,
      filesInfo: files.map(f => ({ originalname: f.originalname, size: f.size })),
    },
  }
};


  @Post('reject')
  reject(@Query('token') token: string) {
    return this.inviteService.rejectInvite(token);
  }
  // ✅ Get all invites
  @Auth([Role.ADMIN, Role.SUPERADMIN])
  @Get()
  findAll() {
    return this.inviteService.findAll();
  }

  // ✅ Get invite by ID
  @Auth([Role.ADMIN, Role.SUPERADMIN])
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.inviteService.findOne(id);
  }

}
