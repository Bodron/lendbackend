import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { AuthModule } from "../auth/auth.module";
import { MessagesModule } from "../messages/messages.module";
import { RentalOffer, RentalOfferSchema } from "../messages/schemas/rental-offer.schema";
import { PaymentsModule } from "../payments/payments.module";
import { PushModule } from "../push/push.module";
import { Product, ProductSchema } from "../products/schemas/product.schema";
import { StorageModule } from "../storage/storage.module";
import { UsersModule } from "../users/users.module";
import { RentalOrdersController } from "./rental-orders.controller";
import { RentalOrdersService } from "./rental-orders.service";
import {
  AvailabilityBlock,
  AvailabilityBlockSchema,
} from "./schemas/availability-block.schema";
import { RentalOrder, RentalOrderSchema } from "./schemas/rental-order.schema";

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: RentalOrder.name, schema: RentalOrderSchema },
      { name: AvailabilityBlock.name, schema: AvailabilityBlockSchema },
      { name: Product.name, schema: ProductSchema },
      { name: RentalOffer.name, schema: RentalOfferSchema },
    ]),
    AuthModule,
    StorageModule,
    UsersModule,
    PaymentsModule,
    MessagesModule,
    PushModule,
  ],
  controllers: [RentalOrdersController],
  providers: [RentalOrdersService],
})
export class RentalOrdersModule {}
