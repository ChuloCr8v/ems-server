import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Put,
  UseInterceptors,
  UploadedFiles,
  Res,
  ParseUUIDPipe,
  UploadedFile,
  Delete,
} from '@nestjs/common';
import { Response } from 'express';
import { join } from 'path';
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
import { FileInterceptor } from '@nestjs/platform-express';
import { AssetService } from './asset.service';
import { AssignAssetDto, CreateAssetDto, ReportFaultDto, UpdateFaultStatusDto } from './dto/assets.dto';
import { Role } from '@prisma/client';
import { Auth } from 'src/auth/decorators/auth.decorator';

@ApiTags('Assets')
@ApiBearerAuth()
@Controller('assets')
export class AssetsController {
  constructor(private readonly assetsService: AssetService) { }

  // @Auth([Role.ADMIN, Role.FACILITY])
  @Post()
  @ApiOperation({ summary: 'Create a new asset' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    description: 'Asset data with optional images',
    type: CreateAssetDto,
  })
  @ApiCreatedResponse({ description: 'Asset successfully created' })
  async create(
    @Body() createAssetDto: CreateAssetDto,
  ) {
    return this.assetsService.createAsset(createAssetDto);
  }

  @Put("update/:id")
  @ApiOperation({ summary: 'Update an asset' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    description: 'Asset data with optional images',
    type: CreateAssetDto,
  })
  @ApiParam({ name: 'id', description: 'Asset ID' })
  @ApiCreatedResponse({ description: 'Asset successfully updated' })
  async updateAsset(
    @Param('id') id: string,
    @Body() updateAssetDto: CreateAssetDto,
    @UploadedFiles() files: {
      assetImage?: Express.Multer.File[],
      barcodeImage?: Express.Multer.File[]
    }
  ) {
    return this.assetsService.updateAsset(id, updateAssetDto);
  }

  @Get('uploads/:filename')
  @ApiOperation({ summary: 'Get uploaded asset image' })
  @ApiParam({ name: 'filename', description: 'Image filename' })
  async getAssetImage(
    @Param('filename') filename: string,
    @Res() res: Response
  ) {
    const filePath = join(process.cwd(), 'uploads', 'assets', filename);
    res.sendFile(filePath);
  }

  @Get('faults/uploads/:filename')
  @ApiOperation({ summary: 'Get uploaded fault image' })
  @ApiParam({ name: 'filename', description: 'Image filename' })
  async getFaultImage(
    @Param('filename') filename: string,
    @Res() res: Response
  ) {
    const filePath = join(process.cwd(), 'uploads', 'faults', filename);
    res.sendFile(filePath);
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

  // @Auth([Role.ADMIN, Role.FACILITY])
  @Put('assign/:id')
  @ApiOperation({ summary: 'Assign asset to user' })
  @ApiBody({ type: AssignAssetDto })
  @ApiCreatedResponse({ description: 'Asset successfully assigned' })
  @ApiResponse({ status: 400, description: 'Invalid assignment data' })
  async assignAsset(@Param("id") id: string, @Body() dto: AssignAssetDto) {
    return this.assetsService.assignAsset(id, dto);
  }

  @Post('report-fault')
  @ApiOperation({ summary: 'Report a fault for an asset' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({ type: ReportFaultDto })
  @ApiCreatedResponse({ description: 'Fault successfully reported' })
  // @UseInterceptors(
  //   FileFieldsInterceptor([{ name: 'images', maxCount: 5 }], {
  //     storage: diskStorage({
  //       destination: './uploads/faults',
  //       filename: (req, file, callback) => {
  //         const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
  //         const ext = extname(file.originalname);
  //         const filename = `${file.fieldname}-${uniqueSuffix}${ext}`;
  //         callback(null, filename);
  //       },
  //     }),
  //   }),
  // )
  async reportFault(
    @Body() reportFaultDto: ReportFaultDto,
    // @UploadedFiles(
    //   new ParseFilePipe({
    //     validators: [
    //       // new MaxFileSizeValidator({ maxSize: 1024 * 1024 * 5 }), // 5MB
    //       new FileTypeValidator({ fileType: '.(png|jpeg|jpg)' }),
    //     ],
    //   }),
    // )
    // images: Array<Express.Multer.File>,
  ) {
    // const imageDetails = images.map(image => ({
    //   url: `/assets/faults/uploads/${image.filename}`,
    //   originalName: image.originalname,
    //   size: image.size,
    //   mimeType: image.mimetype
    // }));

    return this.assetsService.reportFault({
      ...reportFaultDto,
      // images: imageDetails,
    });
  }

  @Put('faults/:id/status')
  @ApiOperation({ summary: 'Update fault status' })
  @ApiParam({ name: 'id', description: 'Fault ID' })
  @ApiBody({ type: UpdateFaultStatusDto })
  @ApiOkResponse({ description: 'Fault status successfully updated' })
  @ApiResponse({ status: 404, description: 'Fault not found' })
  updateFaultStatus(
    @Param('id') id: string,
    @Body() dto: { resolvedById: string, notes: string, }
  ) {
    return this.assetsService.resolveFault(id, dto);
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

  @Get('assigned/:id')
  @ApiOperation({ summary: 'Get assigned asset by ID' })
  @ApiParam({
    name: 'id',
    description: 'UUID of the assigned asset',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @ApiResponse({
    status: 200,
    description: 'Returns the assigned asset with assignment history',
  })
  @ApiResponse({
    status: 404,
    description: 'Asset not found or not currently assigned',
  })
  getAssignedAssetById(@Param('id', ParseUUIDPipe) assetId: string) {
    return this.assetsService.getAssignedAssetById(assetId);
  }

  @Post('bulk-upload')
  @UseInterceptors(FileInterceptor('file'))
  @ApiOperation({ summary: 'Bulk upload assets from Excel file' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    description: 'Excel file containing asset data',
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
        },
      },
    },
  })
  @ApiResponse({
    status: 201,
    description: 'Assets created successfully',
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid file or missing required fields',
  })
  async createMultiAssets(@UploadedFile() file: Express.Multer.File) {
    return this.assetsService.createMultiAssets(file);
  }

  @Put("retrieve")
  async retrieveAsset(@Body() dto: { assetIds: string[], retrievedById: string, notes: string }) {
    return this.assetsService.retrieveAssets(dto)
  }

  @Delete(":id")
  @Auth([Role.ADMIN, Role.SUPERADMIN])
  @ApiOperation({ summary: 'Delete asset by ID' })
  @ApiParam({ name: 'id', required: true, description: 'Asset ID' })
  @ApiResponse({ status: 200, description: 'Asset deleted successfully' })
  async deleteAsset(@Param('id') id: string, @Res() res: Response) {
    await this.assetsService.deleteAsset(id);
    return res.status(200).json({ message: `Asset has been deleted successfully` });
  }
}


