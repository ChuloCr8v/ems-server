import {
    Body,
    Controller,
    Delete,
    Get,
    MaxFileSizeValidator,
    Param,
    ParseFilePipe,
    Post,
    Query,
    Res,
    UploadedFile,
    UseInterceptors,
} from '@nestjs/common';
import { Response } from 'express';
import { FileInterceptor } from '@nestjs/platform-express';
import { UploadsService } from './uploads.service';
import { AuthUser } from 'src/auth/decorators/auth.decorator';
import { IAuthUser } from 'src/auth/dto/auth.dto';
import { memoryStorage } from 'multer';

@Controller('uploads')
export class UploadsController {
    constructor(private readonly uploads: UploadsService) { }

    // @Auth()

    @Post(':id')
    @UseInterceptors(
        FileInterceptor('file', {
            storage: memoryStorage(),
            limits: { fileSize: 10 * 1024 * 1024 },
        }),
    )
    async uploadFile(
        @Param('id') id: string,
        @AuthUser() user: IAuthUser,
        @UploadedFile(
            new ParseFilePipe({
                validators: [new MaxFileSizeValidator({ maxSize: 10 * 1024 * 1024 })],
            }),
        )
        file: Express.Multer.File,
        @Query('order') order?: string,
    ) {
        return await this.uploads.uploadFileToS3(
            id,
            file,
            Number(order) || 0,
            user,
        );
    }

    // @Auth()
    @Get(':id')
    async downloadFile(@Param("id") id: string, @Res() res: Response) {
        const { Body, name, ContentLength, ContentType } =
            await this.uploads.downloadFileFromS3(id);

        res.set({
            'Content-Type': ContentType,
            'Content-Length': ContentLength,
            'Content-Disposition': `attachment; filename="${name}"`,
        });

        Body.pipe(res);
    }

    // @Auth()
    @Delete()
    async deleteFiles(@Body('ids') ids: string[], @AuthUser() user: IAuthUser) {
        return this.uploads.deleteFiles(ids, user);
    }

    // @Auth()
    @Get()
    async getUploads(@Body('ids') ids: string[]) {
        return await this.uploads.getUploads(ids);
    }

    //TODO Add cronjob to delete unused files
}
