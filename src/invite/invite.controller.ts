import { Controller, Post, Body, Query, UploadedFiles, UseInterceptors, Get, Param, Res, Put, Request } from '@nestjs/common';
import { InviteService } from './invite.service';
import { FilesInterceptor } from '@nestjs/platform-express';
import { Auth } from 'src/auth/decorators/auth.decorator';
import { Role } from '@prisma/client';
import { Response } from 'express';
import { CreateProspectDto } from './dto/invite.dto';
import { IAuthUser } from 'src/auth/dto/auth.dto';

@Controller('invite')
export class InviteController {
  constructor(private inviteService: InviteService) {}

  // @Auth([Role.ADMIN, Role.SUPERADMIN])
    @Post('send')
    @UseInterceptors(FilesInterceptor('uploads'))
    async create(@Body() input: CreateProspectDto, @UploadedFiles() uploads: Express.Multer.File[], @Res() res: Response,) {
      const prospect = await this.inviteService.createProspect(input, uploads, );
      return res.status(200).json({ message: `A New Prospect Has Been Added`, prospect});
    }

    @Put('accept/:token')
    async acceptInvite(@Param('token') token: string, @Res() res: Response, @Request() req: { user: IAuthUser}) {
      const prospect =  this.inviteService.acceptInvite(token, req.user);
      return res.status(200).json({ message: `Prospect has accepted the Invitation`, prospect});
    }

    // @Auth([Role.ADMIN, Role.SUPERADMIN])
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

}
