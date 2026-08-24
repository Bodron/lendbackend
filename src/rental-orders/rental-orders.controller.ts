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
  ) {}

  @Post()
  create(
    @Headers("authorization") authorization: string | undefined,
    @Body() dto: CreateRentalOrderDto,
  ) {
    const userId = this.getUserId(authorization);
    return this.rentalOrdersService.create(userId, dto);
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
    return this.rentalOrdersService.createAvailabilityBlock(
      userId,
      user.fullName,
      productId,
      dto,
    );
  }

  @Delete("availability-blocks/:blockId")
  deleteAvailabilityBlock(
    @Headers("authorization") authorization: string | undefined,
    @Param("blockId") blockId: string,
  ) {
    const userId = this.getUserId(authorization);
    return this.rentalOrdersService.deleteAvailabilityBlock(userId, blockId);
  }

  @Patch(":orderId/status")
  updateStatus(
    @Headers("authorization") authorization: string | undefined,
    @Param("orderId") orderId: string,
    @Body() dto: UpdateRentalOrderStatusDto,
  ) {
    this.getUserId(authorization);
    return this.rentalOrdersService.updateStatus(orderId, dto.status);
  }

  @Patch(":orderId/payment-authorized")
  markPaymentAuthorized(
    @Headers("authorization") authorization: string | undefined,
    @Param("orderId") orderId: string,
  ) {
    const userId = this.getUserId(authorization);
    return this.rentalOrdersService.markPaymentAuthorized(userId, orderId);
  }

  @Patch(":orderId/accept")
  async acceptOrder(
    @Headers("authorization") authorization: string | undefined,
    @Param("orderId") orderId: string,
  ) {
    const userId = this.getUserId(authorization);
    const user = await this.authService.getProfile(userId);
    return this.rentalOrdersService.acceptOrder(
      user.id,
      user.fullName,
      orderId,
    );
  }

  @Patch(":orderId/reject")
  async rejectOrder(
    @Headers("authorization") authorization: string | undefined,
    @Param("orderId") orderId: string,
  ) {
    const userId = this.getUserId(authorization);
    const user = await this.authService.getProfile(userId);
    return this.rentalOrdersService.rejectOrder(
      user.id,
      user.fullName,
      orderId,
    );
  }

  @Patch(":orderId/schedule")
  async updateSchedule(
    @Headers("authorization") authorization: string | undefined,
    @Param("orderId") orderId: string,
    @Body() dto: UpdateRentalScheduleDto,
  ) {
    const userId = this.getUserId(authorization);
    const user = await this.authService.getProfile(userId);
    return this.rentalOrdersService.updateSchedule(
      user.id,
      user.fullName,
      orderId,
      dto,
    );
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
