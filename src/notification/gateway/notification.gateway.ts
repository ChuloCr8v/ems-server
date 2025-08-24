import { WebSocketGateway, WebSocketServer, OnGatewayConnection } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';

@WebSocketGateway({
    cors: {},
})
export class NotificationGateway implements OnGatewayConnection {
    @WebSocketServer() server: Server;

    handleConnection(client: Socket) {
        const userId = client.handshake.query.userId as string;
        if (userId) {
            client.join(userId);
            console.log(`✅ User ${userId} connected and joined their room`);
        }
    }

    sendToUser(userId: string, notification: any) {
        this.server.to(userId).emit("notification", notification);
    }
}
