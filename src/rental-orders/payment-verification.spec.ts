import { Types } from "mongoose";
import { RentalOrdersService } from "./rental-orders.service";
import {
  RentalOrderStatus,
  RentalPaymentStatus,
} from "./schemas/rental-order.schema";

describe("Rental payment release", () => {
  const orderId = new Types.ObjectId();
  const productId = new Types.ObjectId();
  const cancelPaymentIntent = jest.fn();
  const refundPaymentIntent = jest.fn();
  const getPaymentIntent = jest.fn();
  const capturePaymentIntent = jest.fn();
  const findUser = jest.fn();
  let order: any;
  let service: RentalOrdersService;

  beforeEach(() => {
    jest.clearAllMocks();
    order = {
      id: orderId.toString(),
      _id: orderId,
      productId,
      status: RentalOrderStatus.Pending,
      paymentStatus: RentalPaymentStatus.Authorized,
      stripePaymentIntentId: "pi_test",
      renterVerifiedAt: new Date(),
      authorizationExpiresAt: new Date(Date.now() + 60_000),
      startDate: new Date("2026-10-01"),
      endDate: new Date("2026-10-02"),
      rentalMode: "day",
      pickupTime: "10:00",
      returnTime: "18:00",
      save: jest.fn(async () => order),
    };
    const rentalModel = {
      findById: jest.fn(() => ({ exec: async () => order })),
    };
    const productModel = {
      findById: jest.fn(() => ({
        exec: async () => ({ ownerId: "owner", stockQuantity: 1 }),
      })),
      findOneAndUpdate: jest.fn(() => ({
        exec: async () => ({ _id: productId }),
      })),
      updateOne: jest.fn(() => ({ exec: async () => ({}) })),
    };
    service = new RentalOrdersService(
      rentalModel as any,
      {} as any,
      productModel as any,
      {} as any,
      { findById: findUser } as any,
      {
        getPaymentIntent,
        cancelPaymentIntent,
        refundPaymentIntent,
        capturePaymentIntent,
        isLiveMode: () => false,
      } as any,
      {} as any,
    );
  });

  it("releases an authorized hold without refunding a charge", async () => {
    getPaymentIntent.mockResolvedValue({ status: "requires_capture" });
    await service.rejectOrder("owner", "Owner", orderId.toString());
    expect(cancelPaymentIntent).toHaveBeenCalledWith("pi_test");
    expect(refundPaymentIntent).not.toHaveBeenCalled();
    expect(order.paymentStatus).toBe(RentalPaymentStatus.Cancelled);
    expect(order.status).toBe(RentalOrderStatus.Rejected);
  });

  it("refunds a previously captured payment", async () => {
    order.paymentStatus = RentalPaymentStatus.Captured;
    getPaymentIntent.mockResolvedValue({ status: "succeeded" });
    refundPaymentIntent.mockResolvedValue({ status: "pending" });
    await service.rejectOrder("owner", "Owner", orderId.toString());
    expect(refundPaymentIntent).toHaveBeenCalledWith("pi_test");
    expect(cancelPaymentIntent).not.toHaveBeenCalled();
    expect(order.paymentStatus).toBe(RentalPaymentStatus.Processing);
  });

  it("captures the held amount only after owner verification and acceptance", async () => {
    findUser.mockResolvedValue({
      identityVerifiedAt: new Date(),
      identityVerificationMode: "test",
    });
    getPaymentIntent.mockResolvedValue({ status: "requires_capture" });
    capturePaymentIntent.mockResolvedValue({ status: "succeeded" });
    (service as any).hasAvailableStock = jest.fn(async () => true);
    (service as any).findOverlappingBlock = jest.fn(async () => null);
    await service.acceptOrder("owner", "Owner", orderId.toString());
    expect(capturePaymentIntent).toHaveBeenCalledWith("pi_test");
    expect(order.status).toBe(RentalOrderStatus.Confirmed);
    expect(order.paymentStatus).toBe(RentalPaymentStatus.Captured);
    expect(order.ownerVerifiedAt).toBeInstanceOf(Date);
  });

  it("does not capture when the owner has not completed verification", async () => {
    findUser.mockResolvedValue({
      identityVerifiedAt: null,
    });
    await expect(
      service.acceptOrder("owner", "Owner", orderId.toString()),
    ).rejects.toThrow("Verifica actul");
    expect(capturePaymentIntent).not.toHaveBeenCalled();
  });
});
