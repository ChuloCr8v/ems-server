import { randomInt } from 'crypto';

export function generateUploadKey(file: Express.Multer.File) {
    const date = new Date().toISOString().substring(0, 10);
    const rand = randomInt(1_000_000, 10_000_000);
    const name = file.originalname.replace(/\s+/g, '-');
    return `${date}-${rand}-${name}`;
}
