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
import { MessagesGateway } from "../messages/messages.gateway";
import { AttachRentalContractDto } from "./dto/attach-rental-contract.dto";
import { CreateAvailabilityBlockDto } from "./dto/create-availability-block.dto";
import { CreateRentalOrderDto } from "./dto/create-rental-order.dto";
import { UpdateRentalScheduleDto } from "./dto/update-rental-schedule.dto";
import { UpdateRentalOrderStatusDto } from "./dto/update-rental-order-status.dto";
import { RentalOrdersService } from "./rental-orders.service";

@Controller("rental-orders")
export class RentalOrdersController {
  constructor(
    private readonly rentalOrdersService: RentalOrdersService,
    private readonly authService: AuthService,
    private readonly messagesGateway: MessagesGateway,
  ) {}

  @Post()
  async create(
    @Headers("authorization") authorization: string | undefined,
    @Body() dto: CreateRentalOrderDto,
  ) {
    const userId = this.getUserId(authorization);
    const order = await this.rentalOrdersService.create(userId, dto);
    this.messagesGateway.broadcastRentalOrder(
      "rental_order.created",
      order,
      await this.rentalOrdersService.findOrderParticipantIds(order),
    );
    return order;
  }

  @Get("me")
  findMine(@Headers("authorization") authorization: string | undefined) {
    const userId = this.getUserId(authorization);
    return this.rentalOrdersService.findMine(userId);
  }

  @Get("owned")
  async findOwned(@Headers("authorization") authorization: string | undefined) {
    const userId = this.getUserId(authorization);
    const user = await this.authService.getProfile(userId);
    return this.rentalOrdersService.findOwned(user.id, user.fullName);
  }

  @Get("products/:productId/availability")
  getAvailability(
    @Param("productId") productId: string,
    @Query("from") from: string,
    @Query("to") to: string,
  ) {
    return this.rentalOrdersService.getAvailability(productId, from, to);
  }

  @Post("products/:productId/availability-blocks")
  async createAvailabilityBlock(
    @Headers("authorization") authorization: string | undefined,
    @Param("productId") productId: string,
    @Body() dto: CreateAvailabilityBlockDto,
  ) {
    const userId = this.getUserId(authorization);
    const user = await this.authService.getProfile(userId);
    const block = await this.rentalOrdersService.createAvailabilityBlock(
      userId,
      user.fullName,
      productId,
      dto,
    );
    this.messagesGateway.broadcastAvailability(productId);
    return block;
  }

  @Delete("availability-blocks/:blockId")
  async deleteAvailabilityBlock(
    @Headers("authorization") authorization: string | undefined,
    @Param("blockId") blockId: string,
  ) {
    const userId = this.getUserId(authorization);
    const result = await this.rentalOrdersService.deleteAvailabilityBlock(
      userId,
      blockId,
    );
    this.messagesGateway.broadcastAvailability(result.productId);
    return result;
  }

  @Patch(":orderId/status")
  async updateStatus(
    @Headers("authorization") authorization: string | undefined,
    @Param("orderId") orderId: string,
    @Body() dto: UpdateRentalOrderStatusDto,
  ) {
    const userId = this.getUserId(authorization);
    const user = await this.authService.getProfile(userId);
    const order = await this.rentalOrdersService.updateStatus(
      orderId,
      dto.status,
      user.id,
      user.fullName,
    );
    this.messagesGateway.broadcastRentalOrder(
      "rental_order.status_changed",
      order,
      [order.renterId, this.getUserId(authorization)],
    );
    this.messagesGateway.broadcastAvailability(order.productId.toString());
    return order;
  }

  @Patch(":orderId/payment-authorized")
  async markPaymentAuthorized(
    @Headers("authorization") authorization: string | undefined,
    @Param("orderId") orderId: string,
  ) {
    const userId = this.getUserId(authorization);
    const order = await this.rentalOrdersService.markPaymentAuthorized(
      userId,
      orderId,
    );
    this.messagesGateway.broadcastRentalOrder(
      "rental_order.updated",
      order,
      await this.rentalOrdersService.findOrderParticipantIds(order),
    );
    return order;
  }

  @Patch(":orderId/renter-ready")
  async markRenterReady(
    @Headers("authorization") authorization: string | undefined,
    @Param("orderId") orderId: string,
  ) {
    const userId = this.getUserId(authorization);
    const order = await this.rentalOrdersService.markRenterReady(
      userId,
      orderId,
    );
    this.messagesGateway.broadcastRentalOrder(
      "rental_order.updated",
      order,
      await this.rentalOrdersService.findOrderParticipantIds(order),
    );
    return order;
  }

  @Patch(":orderId/contract")
  async attachSignedContract(
    @Headers("authorization") authorization: string | undefined,
    @Param("orderId") orderId: string,
    @Body() dto: AttachRentalContractDto,
  ) {
    const userId = this.getUserId(authorization);
    const order = await this.rentalOrdersService.attachSignedContract(
      userId,
      orderId,
      dto,
    );
    this.messagesGateway.broadcastRentalOrder(
      "rental_order.updated",
      order,
      await this.rentalOrdersService.findOrderParticipantIds(order),
    );
    return order;
  }

  @Patch(":orderId/accept")
  async acceptOrder(
    @Headers("authorization") authorization: string | undefined,
    @Param("orderId") orderId: string,
  ) {
    const userId = this.getUserId(authorization);
    const user = await this.authService.getProfile(userId);
    const order = await this.rentalOrdersService.acceptOrder(
      user.id,
      user.fullName,
      orderId,
    );
    this.messagesGateway.broadcastRentalOrder(
      "rental_order.status_changed",
      order,
      [order.renterId, user.id],
    );
    this.messagesGateway.broadcastAvailability(order.productId.toString());
    return order;
  }

  @Patch(":orderId/reject")
  async rejectOrder(
    @Headers("authorization") authorization: string | undefined,
    @Param("orderId") orderId: string,
  ) {
    const userId = this.getUserId(authorization);
    const user = await this.authService.getProfile(userId);
    const order = await this.rentalOrdersService.rejectOrder(
      user.id,
      user.fullName,
      orderId,
    );
    this.messagesGateway.broadcastRentalOrder(
      "rental_order.status_changed",
      order,
      [order.renterId, user.id],
    );
    this.messagesGateway.broadcastAvailability(order.productId.toString());
    return order;
  }

  @Patch(":orderId/schedule")
  async updateSchedule(
    @Headers("authorization") authorization: string | undefined,
    @Param("orderId") orderId: string,
    @Body() dto: UpdateRentalScheduleDto,
  ) {
    const userId = this.getUserId(authorization);
    const user = await this.authService.getProfile(userId);
    const order = await this.rentalOrdersService.updateSchedule(
      user.id,
      user.fullName,
      orderId,
      dto,
    );
    this.messagesGateway.broadcastRentalOrder("rental_order.updated", order, [
      order.renterId,
      user.id,
    ]);
    this.messagesGateway.broadcastAvailability(order.productId.toString());
    return order;
  }

  private getUserId(authorization?: string): string {
    const [type, token] = authorization?.split(" ") ?? [];

    if (type !== "Bearer" || !token) {
      throw new UnauthorizedException("Lipseste tokenul de autentificare.");
    }

    const payload = this.authService.verifyToken(token);
    return payload.sub;
  }
}
