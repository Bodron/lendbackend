import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Post,
  UnauthorizedException,
} from "@nestjs/common";
import { AuthService } from "../auth/auth.service";
import { CreateReviewDto } from "./dto/create-review.dto";
import { ReviewsService } from "./reviews.service";

@Controller("reviews")
export class ReviewsController {
  constructor(
    private readonly reviewsService: ReviewsService,
    private readonly authService: AuthService,
  ) {}

  @Get("product/:productId")
  findForProduct(@Param("productId") productId: string) {
    return this.reviewsService.findForProduct(productId);
  }

  @Get("product/:productId/eligibility")
  eligibility(
    @Headers("authorization") authorization: string | undefined,
    @Param("productId") productId: string,
  ) {
    return this.reviewsService.getEligibility(
      this.getUserId(authorization),
      productId,
    );
  }

  @Post("product/:productId")
  create(
    @Headers("authorization") authorization: string | undefined,
    @Param("productId") productId: string,
    @Body() dto: CreateReviewDto,
  ) {
    return this.reviewsService.create(
      this.getUserId(authorization),
      productId,
      dto,
    );
  }

  private getUserId(authorization?: string) {
    const [type, token] = authorization?.split(" ") ?? [];
    if (type !== "Bearer" || !token)
      throw new UnauthorizedException("Lipseste tokenul de autentificare.");
    return this.authService.verifyToken(token).sub;
  }
}
