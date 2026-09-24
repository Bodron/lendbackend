import { ConflictException } from "@nestjs/common";
import { Types } from "mongoose";
import { RentalOrdersService } from "./rental-orders.service";

describe("manual availability blocks", () => {
  it("rejects a whole-day block when any unit has an hourly rental", async () => {
    const productId = new Types.ObjectId();
    const start = new Date();
    start.setUTCHours(0, 0, 0, 0);
    start.setUTCDate(start.getUTCDate() + 2);
    const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
    const product = { _id: productId, ownerId: "owner", stockQuantity: 2 };
    const order = {
      productId,
      startDate: start,
      endDate: start,
      rentalMode: "hour",
      pickupTime: "10:00",
      returnTime: "12:00",
      status: "confirmed",
    };
    const productModel = {
      findById: jest.fn().mockReturnValue({ exec: async () => product }),
      findOneAndUpdate: jest
        .fn()
        .mockReturnValue({ exec: async () => product }),
      updateOne: jest.fn().mockReturnValue({ exec: async () => ({}) }),
    };
    const orderModel = {
      find: jest.fn().mockReturnValue({ exec: async () => [order] }),
    };
    const blockModel = {
      findOne: jest.fn().mockReturnValue({ exec: async () => null }),
      create: jest.fn(),
    };
    const service = new RentalOrdersService(
      orderModel as any,
      blockModel as any,
      productModel as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
    );

    await expect(
      service.createAvailabilityBlock("owner", "Owner", productId.toString(), {
        startDate: start.toISOString().slice(0, 10),
        endDate: end.toISOString().slice(0, 10),
      }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(blockModel.create).not.toHaveBeenCalled();
  });
});
