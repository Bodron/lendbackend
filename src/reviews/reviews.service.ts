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
import { User, UserDocument } from "../users/schemas/user.schema";
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
    @InjectModel(User.name)
    private readonly userModel: Model<UserDocument>,
  ) {}

  async findForProduct(productId: string) {
    if (!Types.ObjectId.isValid(productId))
      throw new NotFoundException("Anuntul nu a fost gasit.");
    const productObjectId = new Types.ObjectId(productId);
    const reviews = await this.reviewModel
      .find({ productId: productObjectId })
      .sort({ createdAt: -1 })
      .exec();
    return this.withReviewers(reviews);
  }

  async getEligibility(reviewerId: string, productId: string) {
    if (!Types.ObjectId.isValid(productId)) {
      throw new NotFoundException("Anuntul nu a fost gasit.");
    }
    const productObjectId = new Types.ObjectId(productId);

    const orders = await this.rentalOrderModel
      .find({ productId: productObjectId, renterId: reviewerId })
      .sort({ endDate: -1, createdAt: -1 })
      .exec();

    if (orders.length === 0) {
      return {
        canReview: false,
        message: "Poti evalua doar un anunt inchiriat de tine.",
      };
    }

    const completedAndPaidOrders = orders.filter((order) =>
      this.isReviewableCompletedOrder(order),
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
    const productObjectId = new Types.ObjectId(productId);
    const order = await this.rentalOrderModel
      .findOne({
        _id: eligibility.rentalOrderId,
        productId: productObjectId,
        renterId: reviewerId,
        status: RentalOrderStatus.Completed,
        $or: [
          { paymentStatus: RentalPaymentStatus.Captured },
          { paymentStatus: { $exists: false } },
          { paymentStatus: null },
        ],
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
      productId: productObjectId,
      rentalOrderId: order._id,
      reviewerId,
      rating: dto.rating,
      comment: dto.comment.trim(),
    });
    const stats = await this.reviewModel.aggregate([
      { $match: { productId: productObjectId } },
      { $group: { _id: null, average: { $avg: "$rating" } } },
    ]);
    await this.productModel
      .updateOne(
        { _id: productObjectId },
        { $set: { rating: Math.round((stats[0]?.average ?? 0) * 10) / 10 } },
      )
      .exec();
    return (await this.withReviewers([review]))[0];
  }

  private async withReviewers(reviews: ReviewDocument[]) {
    const reviewerIds = [
      ...new Set(reviews.map((review) => review.reviewerId)),
    ];
    const users = await this.userModel
      .find({
        _id: { $in: reviewerIds.filter((id) => Types.ObjectId.isValid(id)) },
      })
      .select("fullName avatarUrl")
      .lean()
      .exec();
    const usersById = new Map(users.map((user) => [user._id.toString(), user]));

    return reviews.map((review) => {
      const reviewer = usersById.get(review.reviewerId);
      return {
        ...review.toObject(),
        reviewer: reviewer
          ? {
              id: reviewer._id.toString(),
              fullName: reviewer.fullName,
              avatarUrl: reviewer.avatarUrl,
            }
          : undefined,
      };
    });
  }

  private isReviewableCompletedOrder(order: {
    status: RentalOrderStatus;
    paymentStatus?: RentalPaymentStatus | null;
  }) {
    return (
      order.status === RentalOrderStatus.Completed &&
      (order.paymentStatus === RentalPaymentStatus.Captured ||
        order.paymentStatus == null)
    );
  }
}
