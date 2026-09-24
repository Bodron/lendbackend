import {
  ConnectedSocket,
  MessageBody,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from "@nestjs/websockets";
import { Server, Socket } from "socket.io";
import { Types } from "mongoose";
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

  broadcastOffer(productId: string, offer: object) {
    this.server.to(`product:${productId}`).emit("offer.updated", offer);
  }

  broadcastRentalOrder(event: string, order: object, userIds: string[]) {
    const payload = this.serialize(order);
    for (const userId of new Set(userIds.filter(Boolean))) {
      this.server.to(this.userRoom(userId)).emit(event, payload);
    }
  }

  broadcastAvailability(productId: string) {
    this.server
      .to(this.availabilityRoom(productId))
      .emit("availability.changed", { productId });
  }

  handleConnection(client: Socket) {
    try {
      const token = client.handshake.auth?.token as string | undefined;
      if (!token) throw new Error("Missing token");
      const user = this.authService.verifyToken(token);
      client.data.userId = user.sub;
      void client.join(this.userRoom(user.sub));
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

  @SubscribeMessage("availability.join")
  joinAvailability(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { productId?: string },
  ) {
    if (data?.productId && Types.ObjectId.isValid(data.productId)) {
      void client.join(this.availabilityRoom(data.productId));
    }
  }

  @SubscribeMessage("availability.leave")
  leaveAvailability(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { productId?: string },
  ) {
    if (data?.productId && Types.ObjectId.isValid(data.productId)) {
      void client.leave(this.availabilityRoom(data.productId));
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

  private availabilityRoom(productId: string) {
    return `availability:${productId}`;
  }

  private userRoom(userId: string) {
    return `user:${userId}`;
  }

  private serialize(value: any) {
    return typeof value?.toObject === "function" ? value.toObject() : value;
  }
}
