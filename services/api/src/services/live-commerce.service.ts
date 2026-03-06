import { Storage } from '@google-cloud/storage';
import { prisma } from '../db';
import { config } from '../config';
import { v4 as uuidv4 } from 'uuid';

const storage = new Storage({ projectId: config.gcp.projectId });

export class LiveCommerceService {
    static async uploadVideo(storeId: string, file: Express.Multer.File, title: string, productIds?: string[]) {
        // If bucket doesn't exist, we fall back to a mock local URL for development 
        // without crashing, to allow testing even if GCP isn't configured
        let publicUrl = `http://localhost:3001/mock-videos/${uuidv4()}-${file.originalname}`;

        if (config.gcp.bucketName) {
            const bucket = storage.bucket(config.gcp.bucketName);
            const filename = `stores/${storeId}/videos/${uuidv4()}-${file.originalname}`;
            const blob = bucket.file(filename);

            await new Promise<void>((resolve, reject) => {
                const stream = blob.createWriteStream({
                    resumable: false,
                    contentType: file.mimetype,
                });
                stream.on('error', (err) => reject(err));
                stream.on('finish', () => resolve());
                stream.end(file.buffer);
            });

            publicUrl = `https://storage.googleapis.com/${config.gcp.bucketName}/${filename}`;
        }

        const video = await prisma.videoClip.create({
            data: {
                storeId,
                title,
                url: publicUrl,
                products: productIds && productIds.length > 0 ? {
                    connect: productIds.map(id => ({ id }))
                } : undefined,
            },
            include: {
                products: true,
            }
        });

        return video;
    }

    static async getVideos(storeId: string, limit: number = 20) {
        return prisma.videoClip.findMany({
            where: { storeId, active: true },
            include: { products: true },
            orderBy: { createdAt: 'desc' },
            take: limit,
        });
    }
}
