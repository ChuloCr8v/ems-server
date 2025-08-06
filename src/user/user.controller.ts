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
  Patch,
  UsePipes,
} from '@nestjs/common';
import { UserService } from './user.service';
import { ApproveUserDto, CreateUserDto, UpdateUserDto, UpdateUserInfo } from './dto/user.dto';
import { Response } from 'express';
import { Auth } from 'src/auth/decorators/auth.decorator';
import { Role } from '@prisma/client';
import { FileFieldsInterceptor, FilesInterceptor } from '@nestjs/platform-express';


@Controller('users')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Post('invite/:id')
  @UseInterceptors(FilesInterceptor('uploads'))
  async createUser(@Param('id') id: string, @Body() data: CreateUserDto, @UploadedFiles() upload: Express.Multer.File[], @Res() res: Response) {
    const user = await this.userService.createUser(id, data, upload);
    return res.status(200).json({ message: `A User Has Sent His/Her Details`, user });
  }

  @Get()
  async findAllUsers(){
    return await this.userService.findAllUsers();
  }

  @Put('approve/:id')
  async approveUser(@Param('id') id: string, @Body() data: ApproveUserDto, @Res() res: Response) {
    const user = await this.userService.approveUser(id, data);
    return res.status(200).json({ message: `User has been Approved`, user})
  }

  // @Auth([Role.ADMIN, Role.SUPERADMIN])
  @Post('info/:id')
  async updateUserInfo(@Param('id') id: string, @Body() comment: UpdateUserInfo, @Res() res: Response) {
    const user = await this.userService.updateUserInfo(id, comment);
    return res.status(200).json({ message: `Update Info Request Sent`, user });
  }

  @Patch(':id')
  @UseInterceptors(FileFieldsInterceptor([{ name: 'uploads', maxCount: 10 }]))
  async updateUser(@Param('id') id: string, @Body() data: UpdateUserDto, @UploadedFiles() upload: { upload?: Express.Multer.File[] }, @Res() res: Response) {
    const user = await this.userService.updateUser(id, data, upload?.upload || []);
    return res.status(200).json({ message: `User Details Has Been Updated`, user})
  }
}
