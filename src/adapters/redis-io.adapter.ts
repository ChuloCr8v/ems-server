
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
            },
            username: process.env.REDIS_USERNAME || 'default',
            password: process.env.REDIS_PASSWORD,
        });

        const subClient = pubClient.duplicate();

        await Promise.all([pubClient.connect(), subClient.connect()]);

        this.adapterConstructor = createAdapter(pubClient, subClient);
        console.log(`✅ Redis Adapter connected to ${process.env.REDIS_HOST}:${process.env.REDIS_PORT}`);
    }

    createIOServer(port: number, options?: ServerOptions): any {
        const server = super.createIOServer(port, options);
        server.adapter(this.adapterConstructor);
        return server;
    }
}
