import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { AuthModule } from "../auth/auth.module";
import { Product, ProductSchema } from "../products/schemas/product.schema";
import {
  RentalOrder,
  RentalOrderSchema,
} from "../rental-orders/schemas/rental-order.schema";
import { UsersModule } from "../users/users.module";
import { PaymentsController } from "./payments.controller";
import { StripePaymentsService } from "./stripe-payments.service";

@Module({
  imports: [
    AuthModule,
    UsersModule,
    MongooseModule.forFeature([
      { name: Product.name, schema: ProductSchema },
      { name: RentalOrder.name, schema: RentalOrderSchema },
    ]),
  ],
  controllers: [PaymentsController],
  providers: [StripePaymentsService],
  exports: [StripePaymentsService],
})
export class PaymentsModule {}
