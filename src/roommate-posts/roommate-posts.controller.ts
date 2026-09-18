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
import { MessagesGateway } from "../messages/messages.gateway";
import { CreateRoommateInterestDto } from "./dto/create-roommate-interest.dto";
import { CreateRoommatePostDto } from "./dto/create-roommate-post.dto";
import { RoommatePostsService } from "./roommate-posts.service";

@Controller("roommate-posts")
export class RoommatePostsController {
  constructor(
    private readonly roommatePostsService: RoommatePostsService,
    private readonly authService: AuthService,
    private readonly messagesGateway: MessagesGateway,
  ) {}

  @Get()
  findAll(
    @Query("minBudget") minBudget?: string,
    @Query("maxBudget") maxBudget?: string,
    @Query("lat") lat?: string,
    @Query("lng") lng?: string,
    @Query("radiusKm") radiusKm?: string,
    @Query("q") q?: string,
  ) {
    return this.roommatePostsService.findAll({
      minBudget,
      maxBudget,
      lat,
      lng,
      radiusKm,
      q,
    });
  }

  @Get("me")
  async findMine(@Headers("authorization") authorization?: string) {
    const user = await this.getUser(authorization);
    return this.roommatePostsService.findMine(user.id);
  }

  @Post()
  async create(
    @Headers("authorization") authorization: string | undefined,
    @Body() dto: CreateRoommatePostDto,
  ) {
    const user = await this.getUser(authorization);
    return this.roommatePostsService.create(user, dto);
  }

  @Post(":postId/interests")
  async createInterest(
    @Headers("authorization") authorization: string | undefined,
    @Param("postId") postId: string,
    @Body() dto: CreateRoommateInterestDto,
  ) {
    const user = await this.getUser(authorization);
    const result = await this.roommatePostsService.createInterest(
      user,
      postId,
      dto,
    );
    if (result.message && result.productId) {
      this.messagesGateway.broadcast(result.productId, result.message);
    }
    return result;
  }

  @Patch(":postId/close")
  close(
    @Headers("authorization") authorization: string | undefined,
    @Param("postId") postId: string,
  ) {
    return this.roommatePostsService.close(
      this.getUserId(authorization),
      postId,
    );
  }

  private async getUser(authorization?: string) {
    const [type, token] = authorization?.split(" ") ?? [];

    if (type !== "Bearer" || !token) {
      throw new UnauthorizedException("Lipseste tokenul de autentificare.");
    }

    const payload = this.authService.verifyToken(token);
    return this.authService.getProfile(payload.sub);
  }

  private getUserId(authorization?: string): string {
    const [type, token] = authorization?.split(" ") ?? [];

    if (type !== "Bearer" || !token) {
      throw new UnauthorizedException("Lipseste tokenul de autentificare.");
    }

    return this.authService.verifyToken(token).sub;
  }
}
