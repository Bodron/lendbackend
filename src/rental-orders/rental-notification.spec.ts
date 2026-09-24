import { Types } from "mongoose";
import { RentalPaymentStatus } from "./schemas/rental-order.schema";
import { RentalOrdersService } from "./rental-orders.service";

describe("rental request notifications", () => {
  it("notifies the owner once when the renter payment succeeds", async () => {
    const orderId = new Types.ObjectId();
    const productId = new Types.ObjectId();
    const order = {
      _id: orderId,
      productId,
      renterId: "renter",
      stripePaymentIntentId: "pi_test",
      paymentStatus: RentalPaymentStatus.RequiresPayment,
      productSnapshot: { title: "PlayStation 5" },
      save: jest.fn().mockImplementation(async () => order),
    };
    const orderModel = {
      findById: jest.fn().mockReturnValue({ exec: async () => order }),
    };
    const productModel = {
      findById: jest.fn().mockReturnValue({
        select: () => ({
          lean: () => ({
            exec: async () => ({ ownerId: "owner", title: "PlayStation 5" }),
          }),
        }),
      }),
    };
    const payments = {
      getPaymentIntent: jest.fn().mockResolvedValue({ status: "succeeded" }),
    };
    const push = { sendRentalRequest: jest.fn().mockResolvedValue(undefined) };
    const service = new RentalOrdersService(
      orderModel as any,
      {} as any,
      productModel as any,
      {} as any,
      {} as any,
      payments as any,
      push as any,
    );

    await service.markPaymentAuthorized("renter", orderId.toString());
    await service.markPaymentAuthorized("renter", orderId.toString());

    expect(push.sendRentalRequest).toHaveBeenCalledWith(
      "owner",
      orderId.toString(),
      productId.toString(),
      "PlayStation 5",
    );
    expect(push.sendRentalRequest).toHaveBeenCalledWith(
      "renter",
      orderId.toString(),
      productId.toString(),
      "PlayStation 5",
      "renting",
    );
    expect(push.sendRentalRequest).toHaveBeenCalledTimes(2);
  });
});
