import {
  Body, Controller, ForbiddenException, Get, Headers, Param, Patch,
  Query, UnauthorizedException,
} from "@nestjs/common";
import { AuthService } from "../auth/auth.service";
import { AdminService } from "./admin.service";

@Controller("admin")
export class AdminController {
  constructor(
    private readonly auth: AuthService,
    private readonly admin: AdminService,
  ) {}

  private async requireAdmin(authorization?: string) {
    const [scheme, token] = authorization?.split(" ") ?? [];
    if (scheme !== "Bearer" || !token) throw new UnauthorizedException();
    const payload = this.auth.verifyToken(token);
    // Read the current role from MongoDB on every request, including mutations.
    const user = await this.auth.getProfile(payload.sub);
    if (user.role !== "super_admin") throw new ForbiddenException();
    return user;
  }

  @Get("me")
  async me(@Headers("authorization") authorization?: string) {
    return this.requireAdmin(authorization);
  }

  @Get("overview")
  async overview(@Headers("authorization") authorization?: string) {
    await this.requireAdmin(authorization);
    return this.admin.overview();
  }

  @Get("users")
  async users(@Headers("authorization") authorization?: string, @Query("page") page?: string, @Query("q") q?: string) {
    await this.requireAdmin(authorization);
    return this.admin.users(page, q);
  }

  @Get("deletions")
  async deletions(@Headers("authorization") authorization?: string, @Query("page") page?: string) {
    await this.requireAdmin(authorization);
    return this.admin.deletions(page);
  }

  @Get("products")
  async products(@Headers("authorization") authorization?: string, @Query("page") page?: string, @Query("q") q?: string) {
    await this.requireAdmin(authorization);
    return this.admin.products(page, q);
  }

  @Patch("products/:id/moderation")
  async moderate(@Headers("authorization") authorization: string | undefined, @Param("id") id: string, @Body() body: { closed?: unknown; reason?: unknown }) {
    const actor = await this.requireAdmin(authorization);
    return this.admin.moderateProduct(id, body, actor.id);
  }

  @Get("orders")
  async orders(@Headers("authorization") authorization?: string, @Query("page") page?: string) {
    await this.requireAdmin(authorization);
    return this.admin.orders(page);
  }

  @Get("sellers")
  async sellers(@Headers("authorization") authorization?: string, @Query("page") page?: string) {
    await this.requireAdmin(authorization);
    return this.admin.sellers(page);
  }

  @Get("viewings")
  async viewings(@Headers("authorization") authorization?: string, @Query("page") page?: string) {
    await this.requireAdmin(authorization);
    return this.admin.viewings(page);
  }
}
