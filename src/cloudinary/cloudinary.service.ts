import { Injectable, Inject, Logger } from '@nestjs/common';
import { CloudinaryResponse } from './cloudinary.types';

@Injectable()
export class CloudinaryService {
    private readonly logger = new Logger(CloudinaryService.name);

    constructor(
        @Inject('CLOUDINARY') private readonly cloudinary: any,
    ) { }

    async uploadImage(file: Express.Multer.File): Promise<CloudinaryResponse> {
        if (!this.cloudinary?.uploader) {
            throw new Error('Cloudinary uploader is not configured');
        }

        if (!file?.buffer) {
            throw new Error('Invalid file provided');
        }

        return new Promise((resolve, reject) => {
            const uploadStream = this.cloudinary.uploader.upload_stream(
                {
                    folder: 'zcl-ems',
                    resource_type: 'auto',
                },
                (error: any, result: CloudinaryResponse) => {
                    if (error) {
                        this.logger.error('Upload error', error);
                        return reject(error);
                    }
                    resolve(result);
                },
            );

            uploadStream.end(file.buffer);
        });
    }

    async deleteImage(publicId: string): Promise<void> {
        console.log(publicId)
        if (!this.cloudinary?.uploader) {
            throw new Error('Cloudinary uploader is not configured');
        }

        try {
            await this.cloudinary.uploader.destroy(publicId);
            console.log("deletion successful", publicId);
        } catch (error) {
            this.logger.error(`Error deleting image ${publicId}`, error);
            throw error;
        }
    }
}