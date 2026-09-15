import { Module } from "@nestjs/common";
import { PushModule } from "../push/push.module";
import { MongooseModule } from "@nestjs/mongoose";
import { AuthModule } from "../auth/auth.module";
import { StorageModule } from "../storage/storage.module";
import { User, UserSchema } from "../users/schemas/user.schema";
import { Product, ProductSchema } from "../products/schemas/product.schema";
import { Message, MessageSchema } from "./schemas/message.schema";
import { RentalOffer, RentalOfferSchema } from "./schemas/rental-offer.schema";
import { MessagesController } from "./messages.controller";
import { MessagesService } from "./messages.service";
import { MessagesGateway } from "./messages.gateway";

@Module({
  imports: [
    PushModule,
    AuthModule,
    StorageModule,
    MongooseModule.forFeature([
      { name: Message.name, schema: MessageSchema },
      { name: Product.name, schema: ProductSchema },
      { name: User.name, schema: UserSchema },
      { name: RentalOffer.name, schema: RentalOfferSchema },
    ]),
  ],
  controllers: [MessagesController],
  providers: [MessagesService, MessagesGateway],
  exports: [MessagesGateway],
})
export class MessagesModule {}
