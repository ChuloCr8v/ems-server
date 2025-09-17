import {
  Controller, Post, Body, UploadedFiles, UseInterceptors, Get, Param, Res, Put, Request,
  Delete
} from '@nestjs/common';
import { InviteService } from './invite.service';
import { FilesInterceptor } from '@nestjs/platform-express';
import { Auth } from 'src/auth/decorators/auth.decorator';
import { Role } from '@prisma/client';
import { Response } from 'express';
import { CreateProspectDto, DeclineComment } from './dto/invite.dto';
import { ApiTags, ApiOperation, ApiResponse, ApiConsumes, ApiBody, ApiParam } from '@nestjs/swagger';

@ApiTags('Invite')
@Controller('invite')
export class InviteController {
  constructor(private inviteService: InviteService) { }

  // @Auth([Role.ADMIN, Role.SUPERADMIN])
  @Post('send')
  @ApiOperation({ summary: 'Send an invitation to create a new prospect' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    description: 'Prospect data with optional file uploads',
    type: CreateProspectDto,
  })
  @ApiResponse({ status: 200, description: 'A New Prospect Has Been Added' })
  @UseInterceptors(FilesInterceptor('uploads'))
  async create(
    @Body() input: CreateProspectDto,
    @UploadedFiles() uploads: Express.Multer.File[],
    @Res() res: Response,
    @Request() req: { user: { id: string } }
  ) {
    const prospect = await this.inviteService.createProspect(input, uploads,
      req.user.id
    );
    return res.status(200).json({ message: `A New Prospect Has Been Added`, prospect });
  }

  @Put('accept/:token')
  @ApiOperation({ summary: 'Accept an invitation' })
  @ApiParam({ name: 'token', required: true, description: 'Invitation token' })
  @ApiResponse({ status: 200, description: 'Prospect Has Accepted The Invitation' })
  async acceptInvite(
    @Param('token') token: string,
    @Res() res: Response,
  ) {
    const prospect = await this.inviteService.acceptInvite(token);
    return res.status(200).json({ message: `Prospect Has Accepted The Invitation`, prospect });
  }

  @Put('decline/:token')
  @ApiOperation({ summary: 'Decline an invitation' })
  @ApiParam({ name: 'token', required: true, description: 'Invitation token' })
  @ApiBody({ type: DeclineComment })
  @ApiResponse({ status: 200, description: 'Prospect Has Declined The Invitation' })
  async declineInvite(
    @Param('token') token: string,
    @Body() reasons: Array<string> | undefined,
    @Res() res: Response,

  ) {
    const prospect = await this.inviteService.declineInvite(token, reasons);
    return res.status(200).json({ message: `Prospect Has Declined The Invitation`, prospect });
  }

  // @Auth([Role.ADMIN, Role.SUPERADMIN])
  @Get()
  @ApiOperation({ summary: 'Get all prospects' })
  @ApiResponse({ status: 200, description: 'All Prospects' })
  async getAllProspects(@Res() res: Response) {
    const prospects = await this.inviteService.getAllProspects();
    return res.status(200).json(prospects);
  }

  @Get('prospect/:token')
  async getInviteByToken(@Param('token') token: string, @Res() res: Response) {
    const invite = await this.inviteService.getInviteByToken(token);
    return res.status(200).json(invite);
  }

  // @Auth([Role.ADMIN, Role.SUPERADMIN])
  @Get(':id')
  @ApiOperation({ summary: 'Get a single prospect by ID' })
  @ApiParam({ name: 'id', required: true, description: 'Prospect ID' })
  @ApiResponse({ status: 200, description: 'Prospect data returned' })
  async getOneProspect(@Param('id') id: string) {
    return await this.inviteService.getOneProspect(id);
  }


  @Delete(":id")
  // @Auth([Role.ADMIN, Role.SUPERADMIN])
  @ApiOperation({ summary: 'Delete a prospect by ID' })
  @ApiParam({ name: 'id', required: true, description: 'Prospect ID' })
  @ApiResponse({ status: 200, description: 'Prospect deleted successfully' })
  async deleteProspect(@Param('id') id: string, @Res() res: Response) {
    await this.inviteService.deleteProspect(id);
    return res.status(200).json({ message: `Prospect with ID ${id} has been deleted successfully` });
  }
}
