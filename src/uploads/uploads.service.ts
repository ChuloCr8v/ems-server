import {
    DeleteObjectsCommand,
    GetObjectCommand,
    PutObjectCommand,
    S3Client,
} from '@aws-sdk/client-s3';
import { Injectable } from '@nestjs/common';
import { subDays } from 'date-fns';
import { bad, mustHave } from 'src/utils/error.utils';
import { Stream } from 'stream';
import { PrismaService } from '../prisma/prisma.service';
import { IAuthUser } from 'src/auth/dto/auth.dto';
import { generateUploadKey } from 'src/utils/uploadkey-generator';
import { CloudinaryService } from 'src/cloudinary/cloudinary.service';
import { S3 } from 'aws-sdk';

@Injectable()
export class UploadsService {
    private s3Client = new S3Client({
    region: process.env.AWS_REGION,
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
        },
    });
     private s3 = new S3({
    region: process.env.AWS_REGION,
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    });

    constructor(private readonly prisma: PrismaService, private readonly cloudinaryService: CloudinaryService) { }

    async getUploads(ids: string[]) {
        const uploads = await this.prisma.upload.findMany({
            where: {
                id: {
                    in: ids,
                },
            },
        });

        const commands = uploads.map(async (up) => {
            const response = await this.s3Client.send(
                new GetObjectCommand({
                    Bucket: process.env.AWS_S3_BUCKET_NAME,
                    Key: up.key,
                }),
            );

            const streamToBuffer = async (stream) => {
                const chunks = [];
                for await (const chunk of stream) {
                    chunks.push(chunk);
                }
                return Buffer.concat(chunks);
            };

            const fileContent = await streamToBuffer(response.Body);
            return {
                ...up,
                fileContent,
            };
        });

        // Resolve all file promises
        const files = await Promise.all(commands);

        return files;
    }

    async upload(file: Express.Multer.File) {
        const key = generateUploadKey(file);
        await this.s3Client.send(
            new PutObjectCommand({
                Bucket: process.env.AWS_S3_BUCKET_NAME,
                Key: key,
                Body: file.buffer,
                ContentType: file.mimetype,
            }),
        );
        return key;
    }

    async uploadFileToS3(
        id: string,
        file: Express.Multer.File,
        order: number,
        user: IAuthUser,
    ) {
        const dbUser = await this.prisma.user.findUnique({
            where: { email: user.email },
        });

        mustHave(dbUser, `No user found with email ${user.email}`, 404);

        const key = await this.upload(file);

        try {
            const cloudinaryUpload = await this.cloudinaryService.uploadImage(file);
            console.log(id)

            await this.prisma.upload.create({
                data: {
                    id,
                    order,
                    userId: dbUser.id,
                    key,
                    name: file.originalname,
                    type: file.mimetype,
                    size: file.size,
                    uri: cloudinaryUpload.secure_url,
                    publicId: cloudinaryUpload.public_id,
                    secureUrl: cloudinaryUpload.secure_url,
                },
            });

            return {
                message: "Upload successful",
                uri: cloudinaryUpload.secure_url,
                publicId: cloudinaryUpload.public_id,
            };

        } catch (error) {
            await this.s3Client.send(
                new DeleteObjectsCommand({
                    Bucket: process.env.AWS_S3_BUCKET_NAME,
                    Delete: { Objects: [{ Key: key }] },
                }),
            );
            console.log(error)
            throw bad("Upload failed. Changes rolled back.", 500);
        }
    }


    async downloadFileFromS3(id: string) {
        const upload = await this.prisma.upload.findUnique({ where: { id } });

        if (!upload) bad('Upload does not exist');

        const command = new GetObjectCommand({
            Bucket: process.env.AWS_S3_BUCKET_NAME,
            Key: upload.key,
        });

        const { Body, ContentLength, ContentType } =
            await this.s3Client.send(command);

        if (Body instanceof Stream) {
            return {
                name: upload.name,
                ContentLength,
                ContentType,
                Body,
            };
        }

        bad('Unexpected file body type');
    }

    async deleteFiles(ids: string[], user: IAuthUser) {
        const dbUser = await this.prisma.user.findUnique({
            where: { email: user.email },
        });

        if (!dbUser) {
            bad('User not found');
        }

        const uploads = await this.prisma.upload.findMany({
            where: { id: { in: ids }, userId: dbUser.id },
        });

        if (uploads.length !== ids.length) {
            bad('One or more uploads do not exist');
        }

        const s3Keys = uploads.filter((u) => u.key).map((u) => ({ Key: u.key }));
        if (s3Keys.length > 0) {
            try {
                await this.s3Client.send(
                    new DeleteObjectsCommand({
                        Bucket: process.env.AWS_S3_BUCKET_NAME,
                        Delete: { Objects: s3Keys },
                    }),
                );
            } catch (err) {
                console.error("⚠️ Failed to delete from S3, continuing...", err);
            }
        }

        for (const upload of uploads) {
            if (upload.publicId) {
                try {
                    await this.cloudinaryService.deleteImage(upload.publicId);
                } catch (err) {
                    console.error(`⚠️ Failed to delete Cloudinary file: ${upload.publicId}`, err);
                }
            }
        }

        await this.prisma.upload.deleteMany({
            where: { id: { in: ids }, userId: dbUser.id },
        });
    }




    async deleteMany(ids: string[]) {
        const uploads = await this.prisma.upload.findMany({
            where: { id: { in: ids } },
        });

        if (uploads.length !== ids.length) {
            bad('One or more uploads do not exist');
        }

        // --- 1. Delete from S3 ---
        try {
            await this.s3Client.send(
                new DeleteObjectsCommand({
                    Bucket: process.env.AWS_S3_BUCKET_NAME,
                    Delete: { Objects: uploads.map((u) => ({ Key: u.key })) },
                }),
            );
        } catch (err) {
            console.error("⚠️ Failed to delete from S3, continuing...", err);
        }

        // --- 2. Delete from Cloudinary ---
        for (const upload of uploads) {
            if (upload.publicId) {
                try {
                    await this.cloudinaryService.deleteImage(upload.publicId);
                } catch (err) {
                    console.error(`⚠️ Failed to delete Cloudinary file: ${upload.publicId}`, err);
                }
            }
        }

        // --- 3. Always delete DB records last ---
        await this.prisma.upload.deleteMany({
            where: { id: { in: ids } },
        });
    }


    async deleteUnusedFilesFromS3() {
        const limit = subDays(Date.now(), 1);
        const uploads = await this.prisma.upload.findMany({
            where: {
                // attachments: { none: {} },
                createdAt: { lt: limit },
            },
        });
        const uploadIds = uploads.map((r) => r.id);
        await this.deleteMany(uploadIds);
    }

//        async getSignedUrl(fileId: string): Promise<string> {
//     // Using AWS SDK v3, we need @aws-sdk/s3-request-presigner
//     const { getSignedUrl } = await import('@aws-sdk/s3-request-presigner');

//     const command = new GetObjectCommand({
//       Bucket: process.env.AWS_BUCKET_NAME,
//       Key: fileId,
//     });

//     return getSignedUrl(this.s3Client, command, { expiresIn: 60 * 60 }); // 1 hour
//   }

 async getSignedUrl(fileId: string): Promise<string> {
    return this.s3.getSignedUrlPromise('getObject', {
      Bucket: process.env.AWS_S3_BUCKET,
      Key: fileId,
      Expires: 60 * 60, // 1 hour validity
    });
  }


}


