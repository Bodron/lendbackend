import { ForbiddenException } from "@nestjs/common";
import { describe, expect, it, jest } from "@jest/globals";
import { Types } from "mongoose";
import {
  RentalOrderStatus,
  RentalPaymentStatus,
} from "../rental-orders/schemas/rental-order.schema";
import { ReviewsService } from "./reviews.service";

describe("ReviewsService", () => {
  const productObjectId = new Types.ObjectId();
  const orderObjectId = new Types.ObjectId();
  const reviewerObjectId = new Types.ObjectId();
  const productId = productObjectId.toString();
  const reviewerId = reviewerObjectId.toString();
  const orderId = orderObjectId.toString();
  const createdReviewObjectId = new Types.ObjectId();
  type TestOrder = {
    _id: Types.ObjectId;
    status: RentalOrderStatus;
    paymentStatus?: RentalPaymentStatus | null;
  };
  type TestReview = {
    _id: Types.ObjectId;
    productId: Types.ObjectId;
    rentalOrderId: Types.ObjectId;
    reviewerId: string;
    rating: number;
    comment: string;
    toObject: () => Record<string, unknown>;
  };

  const makeOrder = (
    overrides: Partial<{
      _id: Types.ObjectId;
      status: RentalOrderStatus;
      paymentStatus: RentalPaymentStatus | null;
    }> = {},
  ): TestOrder => ({
    _id: overrides._id ?? orderObjectId,
    status: overrides.status ?? RentalOrderStatus.Completed,
    ...(overrides.paymentStatus !== undefined
      ? { paymentStatus: overrides.paymentStatus }
      : {}),
  });

  const makeService = ({
    orders = [],
    reviewedOrderIds = [],
    findOneOrder,
    reviewExists = false,
    reviewer = {
      _id: reviewerObjectId,
      fullName: "Test Reviewer",
      avatarUrl: "https://example.com/avatar.jpg",
    },
  }: {
    orders?: TestOrder[];
    reviewedOrderIds?: string[];
    findOneOrder?: TestOrder | null;
    reviewExists?: boolean;
    reviewer?: { _id: Types.ObjectId; fullName: string; avatarUrl?: string };
  } = {}) => {
    const rentalOrderModel = {
      find: jest.fn(() => ({
        sort: jest.fn(() => ({
          exec: jest.fn<() => Promise<TestOrder[]>>().mockResolvedValue(orders),
        })),
      })),
      findOne: jest.fn(() => ({
        exec: jest
          .fn<() => Promise<TestOrder | null>>()
          .mockResolvedValue(findOneOrder ?? orders[0] ?? null),
      })),
    };
    const reviewModel = {
      find: jest.fn(() => ({
        select: jest.fn(() => ({
          lean: jest
            .fn<() => Promise<{ rentalOrderId: Types.ObjectId }[]>>()
            .mockResolvedValue(
              reviewedOrderIds.map((id) => ({
                rentalOrderId: new Types.ObjectId(id),
              })),
            ),
        })),
      })),
      exists: jest.fn<() => Promise<boolean>>().mockResolvedValue(reviewExists),
      create: jest
        .fn<(payload: Record<string, unknown>) => Promise<TestReview>>()
        .mockImplementation((payload) =>
          Promise.resolve({
            _id: createdReviewObjectId,
            productId: payload.productId as Types.ObjectId,
            rentalOrderId: payload.rentalOrderId as Types.ObjectId,
            reviewerId: payload.reviewerId as string,
            rating: payload.rating as number,
            comment: payload.comment as string,
            toObject() {
              return {
                _id: this._id,
                productId: this.productId,
                rentalOrderId: this.rentalOrderId,
                reviewerId: this.reviewerId,
                rating: this.rating,
                comment: this.comment,
              };
            },
          }),
        ),
      aggregate: jest
        .fn<() => Promise<{ average: number }[]>>()
        .mockResolvedValue([{ average: 5 }]),
    };
    const productModel = {
      updateOne: jest.fn(() => ({
        exec: jest
          .fn<() => Promise<{ modifiedCount: number }>>()
          .mockResolvedValue({ modifiedCount: 1 }),
      })),
    };
    const userModel = {
      find: jest.fn(() => ({
        select: jest.fn(() => ({
          lean: jest.fn(() => ({
            exec: jest
              .fn<() => Promise<(typeof reviewer)[]>>()
              .mockResolvedValue([reviewer]),
          })),
        })),
      })),
    };
    const service = new ReviewsService(
      reviewModel as never,
      productModel as never,
      rentalOrderModel as never,
      userModel as never,
    );

    return { service, rentalOrderModel, reviewModel, productModel, userModel };
  };

  it("allows completed rentals with captured payment", async () => {
    const { service, rentalOrderModel } = makeService({
      orders: [makeOrder({ paymentStatus: RentalPaymentStatus.Captured })],
    });

    await expect(
      service.getEligibility(reviewerId, productId),
    ).resolves.toEqual({
      canReview: true,
      rentalOrderId: orderId,
    });
    expect(rentalOrderModel.find).toHaveBeenCalledWith({
      productId: productObjectId,
      renterId: reviewerId,
    });
  });

  it("allows legacy completed rentals with missing payment status", async () => {
    const { service } = makeService({
      orders: [makeOrder()],
    });

    await expect(
      service.getEligibility(reviewerId, productId),
    ).resolves.toEqual({
      canReview: true,
      rentalOrderId: orderId,
    });
  });

  it("rejects rentals that are not completed", async () => {
    const { service } = makeService({
      orders: [
        makeOrder({
          status: RentalOrderStatus.Pending,
          paymentStatus: RentalPaymentStatus.Captured,
        }),
        makeOrder({
          status: RentalOrderStatus.Confirmed,
          paymentStatus: RentalPaymentStatus.Captured,
        }),
      ],
    });

    await expect(
      service.getEligibility(reviewerId, productId),
    ).resolves.toEqual({
      canReview: false,
      message: "Poti lasa un review dupa finalizarea inchirierii.",
    });
  });

  it("rejects completed rentals that already have a review", async () => {
    const { service } = makeService({
      orders: [makeOrder({ paymentStatus: RentalPaymentStatus.Captured })],
      reviewedOrderIds: [orderId],
    });

    await expect(
      service.getEligibility(reviewerId, productId),
    ).resolves.toEqual({
      canReview: false,
      message: "Ai lasat deja un review pentru aceasta inchiriere.",
    });
  });

  it("creates a review for a legacy completed rental", async () => {
    const order = makeOrder();
    const { service, rentalOrderModel, reviewModel, productModel } =
      makeService({
        orders: [order],
        findOneOrder: order,
      });

    await expect(
      service.create(reviewerId, productId, {
        rating: 5,
        comment: "Experienta foarte buna",
      }),
    ).resolves.toMatchObject({
      productId: productObjectId,
      rentalOrderId: order._id,
      reviewerId,
      rating: 5,
      comment: "Experienta foarte buna",
      reviewer: {
        id: reviewerId,
        fullName: "Test Reviewer",
        avatarUrl: "https://example.com/avatar.jpg",
      },
    });
    expect(rentalOrderModel.findOne).toHaveBeenCalledWith({
      _id: orderId,
      productId: productObjectId,
      renterId: reviewerId,
      status: RentalOrderStatus.Completed,
      $or: [
        { paymentStatus: RentalPaymentStatus.Captured },
        { paymentStatus: { $exists: false } },
        { paymentStatus: null },
      ],
    });
    expect(reviewModel.create).toHaveBeenCalledTimes(1);
    expect(productModel.updateOne).toHaveBeenCalledTimes(1);
  });

  it("rejects review creation for non-eligible rentals", async () => {
    const { service, reviewModel } = makeService({
      orders: [
        makeOrder({
          status: RentalOrderStatus.Pending,
          paymentStatus: RentalPaymentStatus.Captured,
        }),
      ],
    });

    await expect(
      service.create(reviewerId, productId, {
        rating: 5,
        comment: "Experienta foarte buna",
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(reviewModel.create).not.toHaveBeenCalled();
  });
});
