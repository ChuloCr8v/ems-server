import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { AssetService } from './asset.service';
import { CreateAssetDto } from './dto/create-asset.dto';
import { Role } from '@prisma/client';


@Controller('assets')
export class AssetController {
  constructor(private readonly assetService: AssetService) {}

  @Post()
  create(@Body() dto: CreateAssetDto) {
    return this.assetService.create(dto);
  }

    // @Post()
    // @UseGuards(AuthGuard) // <-- Use your auth guard
    // async addAsset(
    //     @Body() dto: CreateAssetDto,
    //     @User() user: { id: string; role: Role } // custom decorator to extract user
    // ) {
    //     return this.assetService.createAsset(dto, user);
    // }


  @Get('user/:userId')
  getUserAssets(@Param('userId') userId: string) {
    return this.assetService.findByUser(userId);
  }
}