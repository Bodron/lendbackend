import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { AuthModule } from "../auth/auth.module";
import { CategoriesModule } from "../categories/categories.module";
import { MessagesModule } from "../messages/messages.module";
import { StorageModule } from "../storage/storage.module";
import { UsersModule } from "../users/users.module";
import {
  RentalOrder,
  RentalOrderSchema,
} from "../rental-orders/schemas/rental-order.schema";
import { ProductsController } from "./products.controller";
import { ProductsService } from "./products.service";
import { Product, ProductSchema } from "./schemas/product.schema";

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Product.name, schema: ProductSchema },
      { name: RentalOrder.name, schema: RentalOrderSchema },
    ]),
    AuthModule,
    CategoriesModule,
    MessagesModule,
    StorageModule,
    UsersModule,
  ],
  controllers: [ProductsController],
  providers: [ProductsService],
})
export class ProductsModule {}
