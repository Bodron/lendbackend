import { Body, Controller, Get, Headers, Param, Post, UnauthorizedException } from "@nestjs/common";
import { AuthService } from "../auth/auth.service";
import { CreateMessageDto } from "./dto/create-message.dto";
import { MessagesService } from "./messages.service";

@Controller("messages")
export class MessagesController {
  constructor(
    private readonly messagesService: MessagesService,
    private readonly authService: AuthService,
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
  create(
    @Headers("authorization") authorization: string | undefined,
    @Body() dto: CreateMessageDto,
  ) {
    return this.messagesService.create(this.getUserId(authorization), dto);
  }

  private getUserId(authorization?: string): string {
    const [type, token] = authorization?.split(" ") ?? [];
    if (type !== "Bearer" || !token) {
      throw new UnauthorizedException("Lipseste tokenul de autentificare.");
    }
    return this.authService.verifyToken(token).sub;
  }
}
