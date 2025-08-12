import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Put,
  UseInterceptors,
  UploadedFiles,
  ParseFilePipe,
  MaxFileSizeValidator,
  FileTypeValidator,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBody,
  ApiConsumes,
  ApiBearerAuth,
  ApiParam,
  ApiCreatedResponse,
  ApiOkResponse,
} from '@nestjs/swagger';
import { FilesInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { AssetService } from './asset.service';
import { AssignAssetDto, CreateAssetDto, ReportFaultDto, UpdateFaultStatusDto } from './dto/assets.dto';
import { Auth } from 'src/auth/decorators/auth.decorator';
import { Role } from '@prisma/client';

@ApiTags('Assets')
@ApiBearerAuth()
@Controller('assets')
export class AssetsController {
  constructor(private readonly assetsService: AssetService) {}

  @Auth([Role.ADMIN, Role.FACILITY])
  @Post()
  @ApiOperation({ summary: 'Create a new asset' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    description: 'Asset data with optional images',
    type: CreateAssetDto,
  })
  @ApiCreatedResponse({ description: 'Asset successfully created' })
  @UseInterceptors(
    FilesInterceptor('files', 2, {
      storage: diskStorage({
        destination: './uploads/assets',
        filename: (req, file, callback) => {
          const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
          const ext = extname(file.originalname);
          const filename = `${uniqueSuffix}${ext}`;
          callback(null, filename);
        },
      }),
    }),
  )
  create(
    @Body() createAssetDto: CreateAssetDto,
    @UploadedFiles(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({ maxSize: 1024 * 1024 * 5 }), // 5MB
          new FileTypeValidator({ fileType: '.(png|jpeg|jpg)' }),
        ],
        fileIsRequired: false,
      }),
    )
    files: Array<Express.Multer.File>,
  ) {
    if (files && files.length > 0) {
      createAssetDto.assetImage = files[0]?.path;
      if (files.length > 1) {
        createAssetDto.barcodeImage = files[1]?.path;
      }
    }
    return this.assetsService.createAsset(createAssetDto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all assets' })
  @ApiOkResponse({ description: 'List of all assets' })
  findAll() {
    return this.assetsService.getAllAssets();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get asset by ID' })
  @ApiParam({ name: 'id', description: 'Asset ID' })
  @ApiOkResponse({ description: 'Asset details' })
  @ApiResponse({ status: 404, description: 'Asset not found' })
  findOne(@Param('id') id: string) {
    return this.assetsService.getAssetById(id);
  }

  @Auth([Role.ADMIN, Role.FACILITY])
  @Post('assign')
  @ApiOperation({ summary: 'Assign asset to user' })
  @ApiBody({ type: AssignAssetDto })
  @ApiCreatedResponse({ description: 'Asset successfully assigned' })
  @ApiResponse({ status: 400, description: 'Invalid assignment data' })
  async assignAsset(@Body() assignAssetDto: AssignAssetDto) {
    return this.assetsService.assignAsset(assignAssetDto);
  }

  @Post('report-fault')
  @ApiOperation({ summary: 'Report a fault for an asset' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({ type: ReportFaultDto })
  @ApiCreatedResponse({ description: 'Fault successfully reported' })
  @UseInterceptors(
    FilesInterceptor('images', 5, {
      storage: diskStorage({
        destination: './uploads/faults',
        filename: (req, file, callback) => {
          const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
          const ext = extname(file.originalname);
          const filename = `${uniqueSuffix}${ext}`;
          callback(null, filename);
        },
      }),
    }),
  )
  reportFault(
    @Body() reportFaultDto: ReportFaultDto,
    @UploadedFiles(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({ maxSize: 1024 * 1024 * 5 }), // 5MB
          new FileTypeValidator({ fileType: '.(png|jpeg|jpg)' }),
        ],
      }),
    )
    images: Array<Express.Multer.File>,
  ) {
    reportFaultDto.images = images.map((image) => image.path);
    return this.assetsService.reportFault(reportFaultDto);
  }

  @Put('faults/:id/status')
  @ApiOperation({ summary: 'Update fault status' })
  @ApiParam({ name: 'id', description: 'Fault ID' })
  @ApiBody({ type: UpdateFaultStatusDto })
  @ApiOkResponse({ description: 'Fault status successfully updated' })
  @ApiResponse({ status: 404, description: 'Fault not found' })
  updateFaultStatus(
    @Param('id') id: string,
    @Body() updateFaultStatusDto: UpdateFaultStatusDto,
  ) {
    return this.assetsService.updateFaultStatus(id, updateFaultStatusDto);
  }

  @Get('faulty/list')
  @ApiOperation({ summary: 'Get list of faulty assets' })
  @ApiOkResponse({ description: 'List of faulty assets' })
  getFaultyAssets() {
    return this.assetsService.getFaultyAssets();
  }

  @Get('assigned/list')
  @ApiOperation({ summary: 'Get list of assigned assets' })
  @ApiOkResponse({ description: 'List of assigned assets' })
  getAssignedAssets() {
    return this.assetsService.getAssignedAssets();
  }
}