import { ConflictException, ForbiddenException } from "@nestjs/common";
import { ViewingsService } from "./viewings.service";

describe("ViewingsService payment confirmation", () => {
  const viewingId = "507f1f77bcf86cd799439011";
  const viewing = {
    _id: viewingId,
    visitorId: "visitor-1",
    ownerId: "owner-1",
    status: "awaiting_payment",
    stripePaymentIntentId: "pi_viewing",
  };
  const findById = jest.fn();
  const updateOne = jest.fn();
  const getPaymentIntent = jest.fn();
  const service = new ViewingsService(
    { findById, updateOne } as any,
    {} as any,
    {} as any,
    { getPaymentIntent } as any,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    findById.mockReturnValue({ exec: jest.fn().mockResolvedValue(viewing) });
    updateOne.mockReturnValue({ exec: jest.fn().mockResolvedValue({}) });
  });

  it("rejects confirmation by someone other than the visitor", async () => {
    await expect(
      service.confirmPayment("stranger", viewingId),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(getPaymentIntent).not.toHaveBeenCalled();
  });

  it("does not confirm a viewing until Stripe reports the payment succeeded", async () => {
    getPaymentIntent.mockResolvedValue({
      id: "pi_viewing",
      status: "requires_payment_method",
    });
    await expect(
      service.confirmPayment("visitor-1", viewingId),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(updateOne).not.toHaveBeenCalled();
  });

  it("confirms after Stripe reports payment succeeded", async () => {
    getPaymentIntent.mockResolvedValue({
      id: "pi_viewing",
      status: "succeeded",
    });
    await service.confirmPayment("visitor-1", viewingId);
    expect(updateOne).toHaveBeenCalledWith(
      { stripePaymentIntentId: "pi_viewing", status: "awaiting_payment" },
      { $set: { status: "confirmed", paidAt: expect.any(Date) } },
    );
  });
});
