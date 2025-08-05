import {
  Controller,
  Get,
  Param,
  Post,
  Body,
  NotFoundException,
  UseGuards,
  Put,
  Res,
  UseInterceptors,
  UploadedFiles,
} from '@nestjs/common';
import { UserService } from './user.service';
import { ApproveUserDto, CreateUserDto } from './dto/user.dto';
import { Response } from 'express';
import { Auth } from 'src/auth/decorators/auth.decorator';
import { Role } from '@prisma/client';
import { FilesInterceptor } from '@nestjs/platform-express';

@Controller('users')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Post('invite/:id')
  @UseInterceptors(FilesInterceptor('uploads'))
  async createUser(@Param('id') id: string, @Body() data: CreateUserDto, @UploadedFiles() upload: Express.Multer.File[], @Res() res: Response) {
    const user = await this.userService.createUser(id, data, upload);
    return res.status(200).json({ message: `A User Has Sent His/Her Details`, user });
  }

  @Put('approve/:id')
  async approveUser(@Param('id') id: string, @Body() data: ApproveUserDto, @Res() res: Response) {
    const user = await this.userService.approveUser(id, data);
    return res.status(200).json({ message: `User has been Approved`, user})
  }
}
