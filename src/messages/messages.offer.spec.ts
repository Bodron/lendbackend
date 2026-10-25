import { Types } from "mongoose";
import { MessagesService } from "./messages.service";

describe("Rental offer periods", () => {
  const productId = new Types.ObjectId().toString();
  const create = jest.fn(async (value) => value);
  const product = {
    ownerId: "owner",
    rentalModes: ["hour", "day"],
    pricePerDay: 100,
  };
  const service = new MessagesService(
    {} as any,
    {} as any,
    { findById: () => ({ exec: async () => product }) } as any,
    {} as any,
    {} as any,
    { create } as any,
  );

  beforeEach(() => create.mockClear());

  it("accepts an hourly offer within one calendar day", async () => {
    const startDate = "2026-11-01T10:00:00.000Z";
    const endDate = "2026-11-01T13:00:00.000Z";
    await service.createOffer("renter", {
      productId, amount: 77, startDate, endDate, rentalMode: "hour",
    });
    expect(create).toHaveBeenCalledWith(expect.objectContaining({
      amount: 77,
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      rentalMode: "hour",
    }));
  });

  it("rejects an unsupported monthly mode", async () => {
    await expect(service.createOffer("renter", {
      productId, amount: 77,
      startDate: "2026-11-01T00:00:00.000Z",
      endDate: "2026-12-01T00:00:00.000Z",
      rentalMode: "month",
    })).rejects.toThrow("Modul de inchiriere nu este disponibil");
    expect(create).not.toHaveBeenCalled();
  });
});
