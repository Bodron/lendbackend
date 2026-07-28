import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Patch,
  Post,
  Query,
  UnauthorizedException,
} from "@nestjs/common";
import { AuthService } from "../auth/auth.service";
import { CreateRentalOrderDto } from "./dto/create-rental-order.dto";
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

  @Get("products/:productId/availability")
  getAvailability(
    @Param("productId") productId: string,
    @Query("from") from: string,
    @Query("to") to: string,
  ) {
    return this.rentalOrdersService.getAvailability(productId, from, to);
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

  private getUserId(authorization?: string): string {
    const [type, token] = authorization?.split(" ") ?? [];

    if (type !== "Bearer" || !token) {
      throw new UnauthorizedException("Lipseste tokenul de autentificare.");
    }

    const payload = this.authService.verifyToken(token);
    return payload.sub;
  }
}
