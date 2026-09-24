import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { AuthModule } from "../auth/auth.module";
import { PaymentsModule } from "../payments/payments.module";
import { Product, ProductSchema } from "../products/schemas/product.schema";
import { UsersModule } from "../users/users.module";
import { Viewing, ViewingSchema } from "./schemas/viewing.schema";
import { ViewingsController } from "./viewings.controller";
import { ViewingsService } from "./viewings.service";

@Module({
  imports: [
    AuthModule,
    UsersModule,
    PaymentsModule,
    MongooseModule.forFeature([
      { name: Product.name, schema: ProductSchema },
      { name: Viewing.name, schema: ViewingSchema },
    ]),
  ],
  controllers: [ViewingsController],
  providers: [ViewingsService],
  exports: [ViewingsService],
})
export class ViewingsModule {}
