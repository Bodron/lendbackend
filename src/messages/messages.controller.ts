import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  Param,
  Patch,
  Post,
  Query,
  UnauthorizedException,
} from "@nestjs/common";
import { AuthService } from "../auth/auth.service";
import { CreateMessageDto } from "./dto/create-message.dto";
import { CreateRentalOfferDto } from "./dto/create-rental-offer.dto";
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
    @Query("roommateInterestId") roommateInterestId?: string,
  ) {
    return this.messagesService.findForProduct(
      this.getUserId(authorization),
      productId,
      roommateInterestId,
    );
  }

  @Delete("product/:productId")
  hideThread(
    @Headers("authorization") authorization: string | undefined,
    @Param("productId") productId: string,
    @Query("roommateInterestId") roommateInterestId?: string,
  ) {
    return this.messagesService.hideThread(
      this.getUserId(authorization),
      productId,
      roommateInterestId,
    );
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

  @Get("product/:productId/offers")
  findOffers(
    @Headers("authorization") authorization: string | undefined,
    @Param("productId") productId: string,
  ) {
    return this.messagesService.findOffers(
      this.getUserId(authorization),
      productId,
    );
  }

  @Post("offers")
  async createOffer(
    @Headers("authorization") authorization: string | undefined,
    @Body() dto: CreateRentalOfferDto,
  ) {
    const offer = await this.messagesService.createOffer(
      this.getUserId(authorization),
      dto,
    );
    this.messagesGateway.broadcastOffer(dto.productId, offer);
    return offer;
  }

  @Patch("offers/:offerId/accept")
  async acceptOffer(
    @Headers("authorization") authorization: string | undefined,
    @Param("offerId") offerId: string,
  ) {
    const offer = await this.messagesService.updateOffer(
      this.getUserId(authorization),
      offerId,
      "accepted",
    );
    this.messagesGateway.broadcastOffer(offer.productId.toString(), offer);
    return offer;
  }

  @Patch("offers/:offerId/reject")
  async rejectOffer(
    @Headers("authorization") authorization: string | undefined,
    @Param("offerId") offerId: string,
  ) {
    const offer = await this.messagesService.updateOffer(
      this.getUserId(authorization),
      offerId,
      "rejected",
    );
    this.messagesGateway.broadcastOffer(offer.productId.toString(), offer);
    return offer;
  }

  @Patch("offers/:offerId/claim")
  async claimOffer(
    @Headers("authorization") authorization: string | undefined,
    @Param("offerId") offerId: string,
  ) {
    const offer = await this.messagesService.claimOffer(
      this.getUserId(authorization),
      offerId,
    );
    this.messagesGateway.broadcastOffer(offer.productId.toString(), offer);
    return offer;
  }

  private getUserId(authorization?: string): string {
    const [type, token] = authorization?.split(" ") ?? [];
    if (type !== "Bearer" || !token) {
      throw new UnauthorizedException("Lipseste tokenul de autentificare.");
    }
    return this.authService.verifyToken(token).sub;
  }
}
