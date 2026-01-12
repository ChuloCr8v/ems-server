
import { IoAdapter } from '@nestjs/platform-socket.io';
import { ServerOptions } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import { createClient } from 'redis';

export class RedisIoAdapter extends IoAdapter {
    private adapterConstructor: ReturnType<typeof createAdapter>;

    async connectToRedis(): Promise<void> {
        const pubClient = createClient({
            socket: {
                host: process.env.REDIS_HOST,
                port: parseInt(process.env.REDIS_PORT, 10),
                connectTimeout: 10000, // 10 seconds timeout
                reconnectStrategy: (retries) => {
                    if (retries > 3) {
                        console.error('❌ Redis connection failed after 3 retries');
                        return new Error('Redis connection failed');
                    }
                    return Math.min(retries * 100, 3000);
                },
            },
            username: process.env.REDIS_USERNAME || 'default',
            password: process.env.REDIS_PASSWORD,
        });

        const subClient = pubClient.duplicate();

        // Add error handlers to prevent unhandled error warnings
        pubClient.on('error', (err) => {
            console.error('❌ Redis Pub Client Error:', err.message);
        });

        subClient.on('error', (err) => {
            console.error('❌ Redis Sub Client Error:', err.message);
        });

        try {
            await Promise.all([pubClient.connect(), subClient.connect()]);
            this.adapterConstructor = createAdapter(pubClient, subClient);
            console.log(`✅ Redis Adapter connected to ${process.env.REDIS_HOST}:${process.env.REDIS_PORT}`);
        } catch (error) {
            console.error('❌ Failed to connect to Redis:', error.message);
            console.warn('⚠️  Application will continue without Redis adapter (WebSocket scaling disabled)');
            // Don't throw - allow app to start without Redis
        }
    }

    createIOServer(port: number, options?: ServerOptions): any {
        const server = super.createIOServer(port, options);
        if (this.adapterConstructor) {
            server.adapter(this.adapterConstructor);
        }
        return server;
    }
}
