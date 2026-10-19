import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { AuthModule } from "../auth/auth.module";
import { User, UserSchema } from "../users/schemas/user.schema";
import { Product, ProductSchema } from "../products/schemas/product.schema";
import { RentalOrder, RentalOrderSchema } from "../rental-orders/schemas/rental-order.schema";
import { Viewing, ViewingSchema } from "../viewings/schemas/viewing.schema";
import { AdminController } from "./admin.controller";
import { AdminService } from "./admin.service";

@Module({
  imports: [
    AuthModule,
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: Product.name, schema: ProductSchema },
      { name: RentalOrder.name, schema: RentalOrderSchema },
      { name: Viewing.name, schema: ViewingSchema },
    ]),
  ],
  controllers: [AdminController],
  providers: [AdminService],
})
export class AdminModule {}
