import { AssetCategory, AssetStatus } from '@prisma/client';
import { Transform } from 'class-transformer';
import { IsNotEmpty, IsString, IsNumber, IsDateString, IsOptional, IsArray, IsEnum } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';


export class ImageDto {
  @ApiProperty({
    description: 'URL to access the image',
    example: 'https://example.com/uploads/asset-123.jpg'
  })
  url: string;

  @ApiProperty({
    description: 'Original filename',
    example: 'laptop.jpg'
  })
  originalName?: string;

  @ApiProperty({
    description: 'File size in bytes',
    example: 102400
  })
  size?: number;

  @ApiProperty({
    description: 'MIME type',
    example: 'image/jpeg'
  })
  mimeType?: string;
}

export class CreateAssetDto {
  @ApiProperty({
    description: 'Name of the asset',
    example: 'Dell XPS 15 Laptop',
  })
  @IsNotEmpty()
  @IsString()
  name: string;

  @ApiProperty({
    description: 'Serial number of the asset',
    example: 'DXPS152023-001',
  })
  @IsNotEmpty()
  @IsString()
  serialNo: string;

  @ApiProperty({
    enum: AssetCategory,
    description: 'Category of the asset',
    example: 'IT_EQUIPMENT',
  })
  @IsNotEmpty()
  @IsString()
  category: AssetCategory;

  @ApiProperty({
    description: 'Purchase date of the asset in YYYY-MM-DD format',
    example: '2023-05-15',
  })
  @IsNotEmpty()
  @IsDateString()
  purchaseDate: string;

  @ApiProperty({
    description: 'Vendor from whom the asset was purchased',
    example: 'Dell Technologies',
  })
  @IsNotEmpty()
  @IsString()
  vendor: string;

  @ApiProperty({
    description: 'Cost of the asset',
    example: 1499.99,
    type: Number,
  })
  @IsNotEmpty()
  @IsString()
  @Transform(({ value }) => parseFloat(value))
  cost: number;

  @ApiPropertyOptional({
    description: 'Additional description of the asset',
    example: '15-inch laptop with 16GB RAM and 512GB SSD',
    required: false,
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({
    description: 'Asset image details',
    type: ImageDto,
    required: false
  })
  @IsOptional()
  assetImage?: ImageDto;

  @ApiPropertyOptional({
    description: 'Barcode image details',
    type: ImageDto,
    required: false
  })
  @IsOptional()
  barcodeImage?: ImageDto;
}

export class AssignAssetDto {
  // @ApiProperty({
  //   description: 'ID of the asset to be assigned',
  //   example: 'clnjak9xj000008l49v2q5z6d',
  // })
  // @IsNotEmpty()
  // @IsString()
  // assetId: string;

  @ApiProperty({
    description: 'ID of the user to whom the asset is being assigned',
    example: 'clnjak9xj000008l49v2q5z6d',
  })
  @IsNotEmpty()
  @IsString()
  userId: string;

  // @ApiProperty({
  //   description: 'Date when the asset is assigned (YYYY-MM-DD format)',
  //   example: '2023-06-20',
  // })
  // @IsNotEmpty()
  // @IsDateString()
  // assignedAt: string;

  // @ApiProperty({
  //   description: 'Condition of the asset at the time of assignment',
  //   example: 'Excellent',
  // })
  // @IsNotEmpty()
  // @IsString()
  // condition: string;

  @ApiPropertyOptional({
    description: 'Additional notes about the assignment',
    example: 'Handle with care',
    required: false,
  })
  @IsOptional()
  @IsString()
  notes?: string;

  // @ApiProperty({
  //   enum: AssetStatus,
  //   description: 'Status of the asset after assignment',
  //   example: 'ASSIGNED',
  // })
  // @IsNotEmpty()
  // @IsString()
  // status?: AssetStatus;
}

export class ReportFaultDto {
  @ApiProperty({
    description: 'ID of the faulty asset',
    example: 'clnjak9xj000008l49v2q5z6d',
  })
  @IsNotEmpty()
  @IsString()
  assetId: string;

  @ApiProperty({
    description: 'ID of the user reporting the fault',
    example: 'clnjak9xj000008l49v2q5z6d',
  })
  @IsNotEmpty()
  @IsString()
  reportedBy: string;

  // @ApiProperty({
  //   description: 'Array of image URLs/paths documenting the fault',
  //   example: ['uploads/faults/fault-12345.jpg'],
  //   type: [String],
  // })
  // @IsArray()
  // @IsString({ each: true })
  // images: { url: string; originalName: string; size: number; mimeType: string }[];

  // @ApiProperty({
  //   description: 'Reason for the fault report',
  //   example: 'Screen flickering and unresponsive touchpad',
  // })
  // @IsNotEmpty()
  // @IsString()
  // reason: string;

  @ApiPropertyOptional({
    description: 'Additional notes about the fault',
    example: 'Issue started after recent software update',
    required: false,
  })
  @IsOptional()
  @IsString()
  notes?: string;
}

export class UpdateFaultStatusDto {
  @ApiProperty({
    enum: ['PENDING', 'IN_REVIEW', 'RESOLVED', 'REJECTED'],
    description: 'New status of the fault report',
    example: 'IN_REVIEW',
  })
  @IsNotEmpty()
  @IsString()
  status: 'PENDING' | 'IN_REVIEW' | 'RESOLVED' | 'REJECTED';
}