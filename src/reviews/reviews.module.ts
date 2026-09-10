import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { AuthModule } from "../auth/auth.module";
import { Product, ProductSchema } from "../products/schemas/product.schema";
import { RentalOrder, RentalOrderSchema } from "../rental-orders/schemas/rental-order.schema";
import { ReviewsController } from "./reviews.controller";
import { ReviewsService } from "./reviews.service";
import { Review, ReviewSchema } from "./schemas/review.schema";

@Module({
  imports: [AuthModule, MongooseModule.forFeature([
    { name: Review.name, schema: ReviewSchema },
    { name: Product.name, schema: ProductSchema },
    { name: RentalOrder.name, schema: RentalOrderSchema },
  ])],
  controllers: [ReviewsController],
  providers: [ReviewsService],
})
export class ReviewsModule {}
