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
} from '@nestjs/common';
import { UserService } from './user.service';
import { CreateUserDto, UpdateUserDto } from './dto/user.dto';
import { Response } from 'express';
import { Auth } from 'src/auth/decorators/auth.decorator';
import { Role } from '@prisma/client';

@Controller('users')
export class UserController {
  constructor(private readonly userService: UserService) {}

  // List all users (Admin use)
  // @Get()
  // async findAll() {
  //   return this.userService.findAll();
  // }

  // // Get user by ID
  // @Get(':id')
  // async findOne(@Param('id') id: string) {
  //   const user = await this.userService.findOne(id);
  //   if (!user) throw new NotFoundException('User not found');
  //   return user;
  // }

  // // (Optional) Create user manually (not OAuth)
  // @Post()
  // async create(@Body() createUserDto: CreateUserDto) {
  //   return this.userService.create(createUserDto);
  // }

  // @Auth([Role.ADMIN, Role.SUPERADMIN])
  // @Put(':id')
  // async update(@Param('id') id: string, @Body() data: UpdateUserDto, @Res() res: Response) {
  //   const update = await this.userService.updateUser(id, data);
  //   return res.status(200).json({
  //     message: 'User updated successfully',
  //     user: update,   
  //  });
  // }
}
