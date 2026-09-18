import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { AuthModule } from "../auth/auth.module";
import { Product, ProductSchema } from "../products/schemas/product.schema";
import { StorageModule } from "../storage/storage.module";
import { UsersModule } from "../users/users.module";
import {
  RoommateInterest,
  RoommateInterestSchema,
} from "./schemas/roommate-interest.schema";
import {
  RoommatePost,
  RoommatePostSchema,
} from "./schemas/roommate-post.schema";
import { RoommatePostsController } from "./roommate-posts.controller";
import { RoommatePostsService } from "./roommate-posts.service";

@Module({
  imports: [
    AuthModule,
    StorageModule,
    UsersModule,
    MongooseModule.forFeature([
      { name: Product.name, schema: ProductSchema },
      { name: RoommatePost.name, schema: RoommatePostSchema },
      { name: RoommateInterest.name, schema: RoommateInterestSchema },
    ]),
  ],
  controllers: [RoommatePostsController],
  providers: [RoommatePostsService],
})
export class RoommatePostsModule {}
