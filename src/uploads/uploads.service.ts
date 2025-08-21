import {
    DeleteObjectsCommand,
    GetObjectCommand,
    PutObjectCommand,
    S3Client,
} from '@aws-sdk/client-s3';
import { Injectable } from '@nestjs/common';
import { subDays } from 'date-fns';
import { bad } from 'src/utils/error.utils';
import { Stream } from 'stream';
import { PrismaService } from '../prisma/prisma.service';
import { generateUploadKey } from 'src/utils/uploadkey-generator';
import { IAuthUser } from 'src/auth/dto/auth.dto';

@Injectable()
export class UploadsService {
    private s3Client = new S3Client({
        region: process.env.AWS_REGION,
        credentials: {
            accessKeyId: process.env.AWS_ACCESS_KEY_ID,
            secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
        },
    });

    constructor(private readonly prisma: PrismaService) { }

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

            const streamToBuffer = async (stream: any) => {
                const chunks: Buffer[] = [];
                if (stream && typeof stream.read === 'function') {
                    // Node.js Readable stream
                    for await (const chunk of stream) {
                        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
                    }
                } else {
                    throw new Error('Unsupported stream type');
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
        try {

        } catch (error) {

        }
        const key = generateUploadKey(file);
        await this.s3Client.send(
            new PutObjectCommand({
                Bucket: process.env.AWS_S3_BUCKET_NAME,
                Body: file.buffer,
                ContentType: file.mimetype,
                Key: key,
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
        try {
            const key = await this.upload(file);
            await this.prisma.upload.create({
                data: {
                    id,
                    order,
                    key: key,
                    name: file.originalname,
                    type: file.mimetype,
                    size: file.size,
                    userId: user.sub,
                },
            });
        } catch (error) {
            bad(error.message || 'Failed to upload file');
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

    async deleteFilesFromS3(ids: string[], user: IAuthUser) {
        const uploads = await this.prisma.upload.findMany({
            where: { id: { in: ids }, userId: user.sub },
        });

        if (uploads.length !== ids.length) {
            bad('One or more uploads do not exist');
        }

        await this.s3Client.send(
            new DeleteObjectsCommand({
                Bucket: process.env.AWS_S3_BUCKET_NAME,
                Delete: { Objects: uploads.map((u) => ({ Key: u.key })) },
            }),
        );

        await this.prisma.upload.deleteMany({
            where: { id: { in: ids }, userId: user.sub },
        });
    }

    async deleteMany(ids: string[]) {
        const uploads = await this.prisma.upload.findMany({
            where: { id: { in: ids } },
        });

        if (uploads.length !== ids.length) {
            bad('One or more uploads do not exist');
        }

        await this.s3Client.send(
            new DeleteObjectsCommand({
                Bucket: process.env.AWS_S3_BUCKET_NAME,
                Delete: { Objects: uploads.map((u) => ({ Key: u.key })) },
            }),
        );

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
}
