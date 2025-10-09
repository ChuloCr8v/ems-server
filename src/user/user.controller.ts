import {
  Controller,
  Get,
  Param,
  Post,
  Body,
  Put,
  Res,
  UseInterceptors,
  UploadedFiles,
  Patch,
  Delete,
} from '@nestjs/common';
import { UserService } from './user.service';
import { AddEmployeeDto, ApproveUserDto, UpdateUserDto, UpdateUserInfo } from './dto/user.dto';
import { Response } from 'express';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { Auth, AuthUser } from 'src/auth/decorators/auth.decorator';


@Controller('users')
export class UserController {
  constructor(private readonly userService: UserService) { }

  @Auth()
  @Get('me')
  async getMe(@AuthUser() user: { sub: string; email: string }) {
    return await this.userService.getMe(user.sub);
  }

  @Post('invite/:id')
  async createUser(@Param('id') id: string, @Body() data: UpdateUserDto) {
    return await this.userService.updateUser(id, data, "invite");
  }

  @Put('update/:id')
  async updateEmployee(@Param('id') id: string, @Body() data: { eId: string, email: string, workPhone: string, levelId: string }) {
    return this.userService.updateUser(id, data, "employee");
  }

  @Put('assign-assets/:id')
  async assignAssets(@Param('id') id: string, @Body() data: string[], @Res() res: Response) {
    const user = await this.userService.assignAssets(id, data);
    return res.status(200).json({ message: `Assets assigned`, user });
  }

  @Get()
  async findAllUsers() {
    return await this.userService.findAllUsers();
  }

  @Get(":id")
  async getUser(@Param("id") id: string) {
    return this.userService.getUser(id);
  }

  @Put('approve/:id')
  async approveUser(@Param('id') id: string, @Body() data: ApproveUserDto) {
    return this.userService.approveUser(id, data);

  }

  @Patch(':id')
  @UseInterceptors(FileFieldsInterceptor([{ name: 'uploads', maxCount: 10 }]))
  async updateUser(@Param('id') id: string, @Body() data: UpdateUserDto, @UploadedFiles() uploads: { uploads?: Express.Multer.File[] }, @Res() res: Response) {

    const user = await this.userService.updateEmployee(id, data);
    return res.status(200).json({ message: `User Details Has Been Updated`, user })
  }

  @Post('create')
  async addEmployee(
    @Body() dto: AddEmployeeDto[],
  ) {
    return this.userService.addEmployee(dto);
  }

  @Delete("")
  async deleteUSer(@Body() ids: string[]) {
    return this.userService.deleteUser(ids)
  }
}
