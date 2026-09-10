import { Body, Controller, Get, Headers, Param, Post, UnauthorizedException } from "@nestjs/common";
import { AuthService } from "../auth/auth.service";
import { CreateMessageDto } from "./dto/create-message.dto";
import { MessagesService } from "./messages.service";
import { MessagesGateway } from "./messages.gateway";

@Controller("messages")
export class MessagesController {
  constructor(
    private readonly messagesService: MessagesService,
    private readonly authService: AuthService,
    private readonly messagesGateway: MessagesGateway,
  ) {}

  @Get()
  findThreads(@Headers("authorization") authorization: string | undefined) {
    return this.messagesService.findThreads(this.getUserId(authorization));
  }

  @Get("product/:productId")
  findForProduct(
    @Headers("authorization") authorization: string | undefined,
    @Param("productId") productId: string,
  ) {
    return this.messagesService.findForProduct(this.getUserId(authorization), productId);
  }

  @Post()
  async create(
    @Headers("authorization") authorization: string | undefined,
    @Body() dto: CreateMessageDto,
  ) {
    const message = await this.messagesService.create(
      this.getUserId(authorization),
      dto,
    );
    this.messagesGateway.broadcast(dto.productId, message);
    return message;
  }

  private getUserId(authorization?: string): string {
    const [type, token] = authorization?.split(" ") ?? [];
    if (type !== "Bearer" || !token) {
      throw new UnauthorizedException("Lipseste tokenul de autentificare.");
    }
    return this.authService.verifyToken(token).sub;
  }
}
