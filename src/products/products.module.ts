import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { AuthModule } from "../auth/auth.module";
import { CategoriesModule } from "../categories/categories.module";
import { StorageModule } from "../storage/storage.module";
import { ProductsController } from "./products.controller";
import { ProductsService } from "./products.service";
import { Product, ProductSchema } from "./schemas/product.schema";

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Product.name, schema: ProductSchema }]),
    AuthModule,
    CategoriesModule,
    StorageModule,
  ],
  controllers: [ProductsController],
  providers: [ProductsService],
})
export class ProductsModule {}
