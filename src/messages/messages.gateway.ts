import {
  ConnectedSocket,
  MessageBody,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from "@nestjs/websockets";
import { Server, Socket } from "socket.io";
import { AuthService } from "../auth/auth.service";
import { CreateMessageDto } from "./dto/create-message.dto";
import { MessagesService } from "./messages.service";

@WebSocketGateway({ cors: true })
export class MessagesGateway {
  @WebSocketServer()
  server!: Server;

  constructor(
    private readonly messagesService: MessagesService,
    private readonly authService: AuthService,
  ) {}

  broadcast(productId: string, message: object) {
    this.server.to(`product:${productId}`).emit("message.new", message);
  }

  handleConnection(client: Socket) {
    try {
      const token = client.handshake.auth?.token as string | undefined;
      if (!token) throw new Error("Missing token");
      const user = this.authService.verifyToken(token);
      client.data.userId = user.sub;
    } catch {
      client.disconnect(true);
    }
  }

  @SubscribeMessage("conversation.join")
  joinConversation(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { productId?: string },
  ) {
    if (data?.productId) {
      void client.join(this.room(data.productId));
    }
  }

  @SubscribeMessage("message.send")
  async sendMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() dto: CreateMessageDto,
  ) {
    const message = await this.messagesService.create(client.data.userId, dto);
    this.broadcast(dto.productId, message);
    return message;
  }

  private room(productId: string) {
    return `product:${productId}`;
  }
}
