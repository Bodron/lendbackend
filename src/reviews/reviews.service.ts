import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model, Types } from "mongoose";
import {
  RentalOrder,
  RentalOrderDocument,
  RentalOrderStatus,
  RentalPaymentStatus,
} from "../rental-orders/schemas/rental-order.schema";
import { Product, ProductDocument } from "../products/schemas/product.schema";
import { CreateReviewDto } from "./dto/create-review.dto";
import { Review, ReviewDocument } from "./schemas/review.schema";

@Injectable()
export class ReviewsService {
  constructor(
    @InjectModel(Review.name)
    private readonly reviewModel: Model<ReviewDocument>,
    @InjectModel(Product.name)
    private readonly productModel: Model<ProductDocument>,
    @InjectModel(RentalOrder.name)
    private readonly rentalOrderModel: Model<RentalOrderDocument>,
  ) {}

  async findForProduct(productId: string) {
    if (!Types.ObjectId.isValid(productId))
      throw new NotFoundException("Anuntul nu a fost gasit.");
    return this.reviewModel.find({ productId }).sort({ createdAt: -1 }).exec();
  }

  async getEligibility(reviewerId: string, productId: string) {
    if (!Types.ObjectId.isValid(productId)) {
      throw new NotFoundException("Anuntul nu a fost gasit.");
    }

    const orders = await this.rentalOrderModel
      .find({ productId, renterId: reviewerId })
      .sort({ endDate: -1, createdAt: -1 })
      .exec();

    if (orders.length === 0) {
      return {
        canReview: false,
        message: "Poti evalua doar un anunt inchiriat de tine.",
      };
    }

    const completedAndPaidOrders = orders.filter(
      (order) =>
        order.status === RentalOrderStatus.Completed &&
        order.paymentStatus === RentalPaymentStatus.Captured,
    );
    const reviewedOrderIds = new Set(
      (
        await this.reviewModel
          .find({
            rentalOrderId: {
              $in: completedAndPaidOrders.map((order) => order._id),
            },
          })
          .select("rentalOrderId")
          .lean()
      ).map((review) => review.rentalOrderId.toString()),
    );
    const reviewableOrder = completedAndPaidOrders.find(
      (order) => !reviewedOrderIds.has(order._id.toString()),
    );

    if (reviewableOrder) {
      return {
        canReview: true,
        rentalOrderId: reviewableOrder._id.toString(),
      };
    }

    if (completedAndPaidOrders.length > 0) {
      return {
        canReview: false,
        message: "Ai lasat deja un review pentru aceasta inchiriere.",
      };
    }

    return {
      canReview: false,
      message: "Poti lasa un review dupa finalizarea inchirierii.",
    };
  }

  async create(reviewerId: string, productId: string, dto: CreateReviewDto) {
    const eligibility = await this.getEligibility(reviewerId, productId);
    if (!eligibility.canReview || !eligibility.rentalOrderId) {
      throw new ForbiddenException(
        eligibility.message ?? "Nu poti evalua acest anunt.",
      );
    }
    const order = await this.rentalOrderModel
      .findOne({
        _id: eligibility.rentalOrderId,
        productId,
        renterId: reviewerId,
        status: RentalOrderStatus.Completed,
        paymentStatus: RentalPaymentStatus.Captured,
      })
      .exec();
    if (!order)
      throw new ForbiddenException(
        "Inchirierea nu mai este eligibila pentru review.",
      );
    if (await this.reviewModel.exists({ rentalOrderId: order._id })) {
      throw new ConflictException(
        "Ai lasat deja un review pentru aceasta inchiriere.",
      );
    }

    const review = await this.reviewModel.create({
      productId,
      rentalOrderId: order._id,
      reviewerId,
      rating: dto.rating,
      comment: dto.comment.trim(),
    });
    const stats = await this.reviewModel.aggregate([
      { $match: { productId: new Types.ObjectId(productId) } },
      { $group: { _id: null, average: { $avg: "$rating" } } },
    ]);
    await this.productModel
      .updateOne(
        { _id: productId },
        { $set: { rating: Math.round((stats[0]?.average ?? 0) * 10) / 10 } },
      )
      .exec();
    return review;
  }
}
