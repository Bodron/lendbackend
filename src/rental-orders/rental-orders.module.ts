import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { AuthModule } from "../auth/auth.module";
import { Product, ProductSchema } from "../products/schemas/product.schema";
import { StorageModule } from "../storage/storage.module";
import { UsersModule } from "../users/users.module";
import { RentalOrdersController } from "./rental-orders.controller";
import { RentalOrdersService } from "./rental-orders.service";
import { RentalOrder, RentalOrderSchema } from "./schemas/rental-order.schema";

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: RentalOrder.name, schema: RentalOrderSchema },
      { name: Product.name, schema: ProductSchema },
    ]),
    AuthModule,
    StorageModule,
    UsersModule,
  ],
  controllers: [RentalOrdersController],
  providers: [RentalOrdersService],
})
export class RentalOrdersModule {}
