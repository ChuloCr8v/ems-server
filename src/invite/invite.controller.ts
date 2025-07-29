import { Controller, Post, Body, Query, UploadedFiles, UseInterceptors, Get, Param, Res, Put, Request } from '@nestjs/common';
import { InviteService } from './invite.service';
import { FilesInterceptor } from '@nestjs/platform-express';
import { Auth } from 'src/auth/decorators/auth.decorator';
import { Role } from '@prisma/client';
import { Response } from 'express';
import { AcceptInviteDto, CreateProspectDto } from './dto/invite.dto';
import { IAuthUser } from 'src/auth/dto/auth.dto';

@Controller('invite')
export class InviteController {
  constructor(private inviteService: InviteService) {}

  // @Auth([Role.ADMIN, Role.SUPERADMIN])
  @Post('send')
  @UseInterceptors(FilesInterceptor('uploads'))
  async create(@Body() input: CreateProspectDto, @UploadedFiles() uploads: Express.Multer.File[], @Res() res: Response, @Request() req: { user: IAuthUser}) {
    const prospect = await this.inviteService.createProspect(input, uploads, req.user);
    return res.status(200).json({ message: `A New Prospect Has Been Added`, prospect});
  }

  @Put('accept')
  async acceptInvite(@Param('token') token: AcceptInviteDto, @Res() res: Response, @Request() req: { user: IAuthUser}) {
    const prospect =  this.inviteService.acceptInvite(token, req.user);
    return res.status(200).json({ message: `Prospect has accepted the Invitation`, prospect});
  }

  @Auth([Role.ADMIN, Role.SUPERADMIN])
  @Get()
  async getAllProspects(@Res() res: Response) {
    const prospects = await this.inviteService.getAllProspects();
    return res.status(200).json({ message: `All Prospects`, prospects });
  }

  @Auth([Role.ADMIN, Role.SUPERADMIN])
  @Get(':id')
  async getOneProspect(@Param('id') id: string) {
    return await this.inviteService.getOneProspect(id);
  }



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
