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
import { AddEmployeeDto, ApproveUserDto, UpdateUserDto, UpdateUserInfo } from './dto/user.dto';
import { Response } from 'express';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { Auth, AuthUser } from 'src/auth/decorators/auth.decorator';
import { ReqPayload } from 'src/auth/dto/auth.dto';


@Controller('users')
export class UserController {
  constructor(private readonly userService: UserService) { }

  @Auth()
  @Get('me')
  async getMe(@AuthUser() user: { sub: string; email: string }) {
    return await this.userService.getMe(user.sub);
  }

  // @Auth(["ADMIN", "HR"])
  @Post('invite/:id')
  async createUser(@Param('id') id: string, @Body() data: UpdateUserDto) {
    return await this.userService.updateUser(id, data, "invite");
  }

  @Auth(["ADMIN", "HR", "FACILITY"])
  @Put('update/:id')
  async updateEmployee(@Param('id') id: string, @Body() data: UpdateUserDto) {
    return this.userService.updateUser(id, data, "employee");
  }

  @Auth(["ADMIN", "FACILITY"])
  @Put('assign-assets/:id')
  async assignAssets(@Param('id') id: string, @Body() data: string[], @Res() res: Response) {
    const user = await this.userService.assignAssets(id, data);
    return res.status(200).json({ message: `Assets assigned`, user });
  }

  @Auth(["ADMIN", "HR", "FACILITY"])
  @Get()
  async findAllUsers() {
    return await this.userService.findAllUsers();
  }

  @Auth()
  @Get(":id")
  async getUser(@Param("id") id: string, @Req() req: ReqPayload) {
    const requesterId = req.user.id
    return this.userService.getUser(id, requesterId);
  }

  @Auth(["ADMIN", "HR"])
  @Put('approve/:id')
  async approveUser(@Param('id') id: string, @Body() data: ApproveUserDto) {
    return this.userService.approveUser(id, data);
  }

  @Auth(["ADMIN", "HR", "FACILITY"])
  @Patch(':id')
  @UseInterceptors(FileFieldsInterceptor([{ name: 'uploads', maxCount: 10 }]))
  async updateUser(@Param('id') id: string, @Body() data: UpdateUserDto, @UploadedFiles() uploads: { uploads?: Express.Multer.File[] }, @Res() res: Response) {

    const user = await this.userService.updateEmployee(id, data);
    return res.status(200).json({ message: `User Details Has Been Updated`, user })
  }

  @Auth(["ADMIN", "HR"])
  @Post('create')
  async addEmployee(
    @Body() dto: AddEmployeeDto[],
  ) {
    return this.userService.addEmployee(dto);
  }

  @Auth(["ADMIN"])
  @Delete("")
  async deleteUSer(@Body() ids: string[]) {
    return this.userService.deleteUser(ids)
  }
}
