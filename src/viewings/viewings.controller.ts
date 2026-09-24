import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Patch,
  Post,
  UnauthorizedException,
} from "@nestjs/common";
import { AuthService } from "../auth/auth.service";
import { RequestViewingDto } from "./dto/request-viewing.dto";
import { ViewingsService } from "./viewings.service";

@Controller("viewings")
export class ViewingsController {
  constructor(
    private readonly service: ViewingsService,
    private readonly auth: AuthService,
  ) {}

  @Get("me")
  mine(@Headers("authorization") authorization?: string) {
    return this.service.mine(this.userId(authorization));
  }

  @Post()
  request(
    @Headers("authorization") authorization: string | undefined,
    @Body() dto: RequestViewingDto,
  ) {
    return this.service.request(this.userId(authorization), dto);
  }

  @Patch(":id/accept")
  accept(
    @Headers("authorization") authorization: string | undefined,
    @Param("id") id: string,
  ) {
    return this.service.accept(this.userId(authorization), id);
  }

  @Patch(":id/reject")
  reject(
    @Headers("authorization") authorization: string | undefined,
    @Param("id") id: string,
  ) {
    return this.service.reject(this.userId(authorization), id);
  }

  @Patch(":id/complete")
  complete(
    @Headers("authorization") authorization: string | undefined,
    @Param("id") id: string,
  ) {
    return this.service.complete(this.userId(authorization), id);
  }

  @Patch(":id/cancel")
  cancel(
    @Headers("authorization") authorization: string | undefined,
    @Param("id") id: string,
  ) {
    return this.service.cancel(this.userId(authorization), id);
  }

  @Post(":id/payment")
  payment(
    @Headers("authorization") authorization: string | undefined,
    @Param("id") id: string,
  ) {
    return this.service.startPayment(this.userId(authorization), id);
  }

  @Patch(":id/payment-confirmed")
  paymentConfirmed(
    @Headers("authorization") authorization: string | undefined,
    @Param("id") id: string,
  ) {
    return this.service.confirmPayment(this.userId(authorization), id);
  }

  @Patch(":id/identity-confirmed")
  identityConfirmed(
    @Headers("authorization") authorization: string | undefined,
    @Param("id") id: string,
  ) {
    return this.service.confirmIdentities(this.userId(authorization), id);
  }

  private userId(authorization?: string) {
    const [type, token] = authorization?.split(" ") ?? [];
    if (type !== "Bearer" || !token) throw new UnauthorizedException();
    return this.auth.verifyToken(token).sub;
  }
}
