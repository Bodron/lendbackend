import { Body, Controller, Delete, Get, Headers, Param, Post, Put, UnauthorizedException } from "@nestjs/common";
import { AuthService } from "../auth/auth.service";
import { ImportFavoritesDto } from "./dto/import-favorites.dto";
import { FavoritesService } from "./favorites.service";

@Controller("favorites")
export class FavoritesController {
  constructor(
    private readonly favorites: FavoritesService,
    private readonly auth: AuthService,
  ) {}

  @Get()
  list(@Headers("authorization") authorization?: string) {
    return this.favorites.list(this.userId(authorization));
  }

  @Put(":productId")
  add(@Headers("authorization") authorization: string | undefined, @Param("productId") productId: string) {
    return this.favorites.add(this.userId(authorization), productId);
  }

  @Delete(":productId")
  remove(@Headers("authorization") authorization: string | undefined, @Param("productId") productId: string) {
    return this.favorites.remove(this.userId(authorization), productId);
  }

  @Post("import")
  import(@Headers("authorization") authorization: string | undefined, @Body() dto: ImportFavoritesDto) {
    return this.favorites.import(this.userId(authorization), dto.productIds);
  }

  private userId(authorization?: string) {
    const [kind, token] = authorization?.split(" ") ?? [];
    if (kind !== "Bearer" || !token) throw new UnauthorizedException("Autentificarea este necesara.");
    return this.auth.verifyToken(token).sub;
  }
}
