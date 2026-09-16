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
  const productId = productObjectId.toString();
  const reviewerId = "test-reviewer-id";
  const orderId = orderObjectId.toString();
  type TestOrder = {
    _id: Types.ObjectId;
    status: RentalOrderStatus;
    paymentStatus?: RentalPaymentStatus | null;
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
  }: {
    orders?: TestOrder[];
    reviewedOrderIds?: string[];
    findOneOrder?: TestOrder | null;
    reviewExists?: boolean;
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
        .fn<
          (payload: Record<string, unknown>) => Promise<Record<string, unknown>>
        >()
        .mockImplementation((payload) =>
          Promise.resolve({
            _id: new Types.ObjectId(),
            ...payload,
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
    const service = new ReviewsService(
      reviewModel as never,
      productModel as never,
      rentalOrderModel as never,
    );

    return { service, rentalOrderModel, reviewModel, productModel };
  };

  it("allows completed rentals with captured payment", async () => {
    const { service } = makeService({
      orders: [makeOrder({ paymentStatus: RentalPaymentStatus.Captured })],
    });

    await expect(
      service.getEligibility(reviewerId, productId),
    ).resolves.toEqual({
      canReview: true,
      rentalOrderId: orderId,
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
      productId,
      rentalOrderId: order._id,
      reviewerId,
      rating: 5,
      comment: "Experienta foarte buna",
    });
    expect(rentalOrderModel.findOne).toHaveBeenCalledWith({
      _id: orderId,
      productId,
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
