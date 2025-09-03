import { BadRequestException } from '@nestjs/common';

export interface UploadValidationOptions {
  allowedMimeTypes?: string[];
  maxFileSize?: number;
  maxFiles?: number;
}

export class UploadValidationUtil {
  static validateFile(
    file: Express.Multer.File,
    options: UploadValidationOptions = {},
  ): void {
    const {
      allowedMimeTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/jpg'],
      maxFileSize = 10 * 1024 * 1024, // 10MB
    } = options;

    // Check if file exists
    if (!file) {
      throw new BadRequestException('No file provided');
    }

    // Validate file type
    if (!allowedMimeTypes.includes(file.mimetype)) {
      throw new BadRequestException(
        `Invalid file type: ${file.originalname}. Only ${allowedMimeTypes.join(', ')} are allowed.`,
      );
    }

    // Validate file size
    if (file.size > maxFileSize) {
      throw new BadRequestException(
        `File too large: ${file.originalname}. Maximum size is ${maxFileSize / 1024 / 1024}MB.`,
      );
    }

    // Validate file name (optional security check)
    if (!file.originalname || file.originalname.includes('..') || file.originalname.includes('/')) {
      throw new BadRequestException('Invalid file name');
    }
  }

  static validateFiles(
    files: Express.Multer.File[],
    options: UploadValidationOptions = {},
  ): void {
    const {
      maxFiles = 10,
    } = options;

    // Check if files exist
    if (!files || files.length === 0) {
      throw new BadRequestException('No files provided');
    }

    // Validate number of files
    if (files.length > maxFiles) {
      throw new BadRequestException(`Maximum of ${maxFiles} files allowed`);
    }

    // Validate each file
    files.forEach((file) => {
      this.validateFile(file, options);
    });
  }

  static getFileExtension(mimetype: string): string {
    const extensionMap: { [key: string]: string } = {
      'application/pdf': 'pdf',
      'image/jpeg': 'jpg',
      'image/jpg': 'jpg',
      'image/png': 'png',
    };

    return extensionMap[mimetype] || 'bin';
  }

  static generateUniqueFileName(file: Express.Multer.File): string {
    const extension = this.getFileExtension(file.mimetype);
    const timestamp = Date.now();
    const randomString = Math.random().toString(36).substring(2, 15);
    return `payment_${timestamp}_${randomString}.${extension}`;
  }
}