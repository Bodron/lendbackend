import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { AuthModule } from "../auth/auth.module";
import { Product, ProductSchema } from "../products/schemas/product.schema";
import { FavoritesController } from "./favorites.controller";
import { FavoritesService } from "./favorites.service";
import { Favorite, FavoriteSchema } from "./schemas/favorite.schema";

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Favorite.name, schema: FavoriteSchema },
      { name: Product.name, schema: ProductSchema },
    ]),
    AuthModule,
  ],
  controllers: [FavoritesController],
  providers: [FavoritesService],
})
export class FavoritesModule {}
