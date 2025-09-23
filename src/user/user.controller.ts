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
  Req,
} from '@nestjs/common';
import { UserService } from './user.service';
import { AddEmployeeDto, ApproveUserDto, PartialCreateUserDto, UpdateUserDto, UpdateUserInfo } from './dto/user.dto';
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
  async createUser(@Param('id') id: string, @Body() data: PartialCreateUserDto, @Res() res: Response) {
    const user = await this.userService.updateUserData(id, data);
    return res.status(200).json({ message: `A User Has Sent His/Her Details`, user });
  }

  @Put('update/:id')
  async updateEmployee(@Param('id') id: string, @Body() data: { eId: string, workEmail: string, workPhone: string }, @Res() res: Response) {
    const user = await this.userService.updateEmployeeData(id, data);
    return res.status(200).json({ message: `User updated successfully`, user });
  }

  @Put('assign-assets/:id')
  async assignAssets(@Param('id') id: string, @Body() data: string[], @Res() res: Response) {
    const user = await this.userService.assignAssets(id, data);
    return res.status(200).json({ message: `Assets assid`, user });
  }

  @Get()
  async findAllUsers() {
    return await this.userService.findAllUsers();
  }

  @Get(":id")
  async getUser(@Param("id") id: string) {
    return await this.userService.getUser(id);
  }

  @Put('approve/:id')
  async approveUser(@Param('id') id: string, @Body() data: ApproveUserDto, @Res() res: Response) {
    const user = await this.userService.approveUser(id, data);
    return res.status(200).json({ message: `User has been Approved`, user })
  }

  // @Auth([Role.ADMIN, Role.SUPERADMIN])
  @Post('info/:id')
  async updateUserInfo(@Param('id') id: string, @Body() comment: UpdateUserInfo, @Res() res: Response) {
    const user = await this.userService.updateUserInfo(id, comment);
    return res.status(200).json({ message: `Update Info Request Sent`, user });
  }

  @Patch(':id')
  @UseInterceptors(FileFieldsInterceptor([{ name: 'uploads', maxCount: 10 }]))
  async updateUser(@Param('id') id: string, @Body() data: UpdateUserDto, @UploadedFiles() uploads: { uploads?: Express.Multer.File[] }, @Res() res: Response) {

    const user = await this.userService.updateUser(id, data, uploads?.uploads || []);
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
