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
  BadRequestException,
  Req,
} from '@nestjs/common';
import { UserService } from './user.service';
import { AddEmployeeDto, ApproveUserDto, CreateUserDto, PartialCreateUserDto, UpdateUserDto, UpdateUserInfo } from './dto/user.dto';
import { Response } from 'express';
import { FileFieldsInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';


@Controller('users')
export class UserController {
  constructor(private readonly userService: UserService) { }

  @Post('invite/:id')
  async createUser(@Param('id') id: string, @Body() data: PartialCreateUserDto, @Res() res: Response) {
    const user = await this.userService.createUser(id, data);
    return res.status(200).json({ message: `A User Has Sent His/Her Details`, user });
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

  @Post('add')
  @UseInterceptors(
    FilesInterceptor('files', 5, {
      storage: diskStorage({
        destination: './uploads/employees',
        filename: (req, file, callback) => {
          const uniqueSuffix =
            Date.now() + '-' + Math.round(Math.random() * 1e9);
          const ext = extname(file.originalname);
          callback(null, `${uniqueSuffix}${ext}`);
        },
      }),
      fileFilter: (req, file, callback) => {
        if (
          !file.originalname.match(
            /\.(jpg|jpeg|png|gif|pdf|doc|docx|xls|xlsx)$/i,
          )
        ) {
          return callback(
            new Error('Only image, PDF and document files are allowed!'),
            false,
          );
        }
        callback(null, true);
      },
      limits: {
        fileSize: 5 * 1024 * 1024, // 5MB
      },
    }),
  )
  // async addEmployee(
  //   @Body() body: AddEmployeeDto,
  //   @UploadedFiles() files: Express.Multer.File[],
  //   @Req() req: Request,
  // ) {
  //   try {
  //     // Validate contract duration if job type is CONTRACT
  //     if (body.jobType === 'CONTRACT' && !body.duration) {
  //       throw new BadRequestException(
  //         'Duration is required for contract employees',
  //       );
  //     }

  //     // Check if email already exists
  //     const existingEmployee = await this.userService.findByEmail(
  //       body.email,
  //     );
  //     if (existingEmployee) {
  //       throw new BadRequestException('Email already exists');
  //     }

  //     // Process file paths
  //     const filePaths = files?.map((file) => ({
  //       path: file.path,
  //       originalname: file.originalname,
  //       mimetype: file.mimetype,
  //       size: file.size,
  //     }));

  //     // Create employee with file references
  //     // const employee = await this.userService.create({
  //     //   ...body,
  //     //   files: filePaths,
  //     // });

  //     // return {
  //     //   success: true,
  //     //   data: employee,
  //     //   message: 'Employee created successfully',
  //     // };
  //   } catch (error) {
  //     // Clean up uploaded files if error occurs
  //     // if (files?.length) {
  //     //   await this.userService.cleanupFiles(files);
  //     // }
  //     throw new BadRequestException(
  //       error.message || 'Failed to create employee',
  //     );
  //   }
  // }

  async addEmployee(
    @Body() body: any,
    @UploadedFiles() files: Express.Multer.File[]
  ) {
    try {
      // Parse nested JSON strings
      const parsedBody = {
        ...body,
        emergencyContact: JSON.parse(body.emergencyContact),
        guarantorContact: JSON.parse(body.guarantorContact),
      };

      // Validate using class-validator
      const dto = plainToInstance(AddEmployeeDto, parsedBody);
      const errors = await validate(dto);

      if (errors.length > 0) {
        throw new BadRequestException(errors);
      }

      return this.userService.addEmployee(dto, files);
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException('Invalid request format');
    }
  }

}
