import { ConflictException, ForbiddenException } from "@nestjs/common";
import { ViewingsService } from "./viewings.service";

describe("ViewingsService proposals", () => {
  const id = "507f1f77bcf86cd799439011";
  const startsAt = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
  const proposedStartsAt = new Date(Date.now() + 4 * 24 * 60 * 60 * 1000);
  const viewing = {
    _id: id,
    productId: id,
    ownerId: "owner-1",
    visitorId: "visitor-1",
    startsAt,
    priceRon: 25,
    status: "requested",
  };
  const findById = jest.fn();
  const exists = jest.fn();
  const findOneAndUpdate = jest.fn();
  const findUserById = jest.fn();
  const getAccount = jest.fn();
  const getPaymentIntent = jest.fn();
  const refundViewingPaymentIntent = jest.fn();
  const service = new ViewingsService(
    { findById, exists, findOneAndUpdate } as any,
    {} as any,
    { findById: findUserById } as any,
    { getAccount, getPaymentIntent, refundViewingPaymentIntent } as any,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    findById.mockReturnValue({ exec: async () => viewing });
    exists.mockResolvedValue(null);
    findOneAndUpdate.mockImplementation((_filter, update) => ({
      exec: async () => ({ ...viewing, ...update.$set }),
    }));
    findUserById.mockResolvedValue({ stripeAccountId: "acct_owner" });
    getAccount.mockResolvedValue({ capabilities: { transfers: "active" } });
  });

  it("lets only the owner propose a future time without charging", async () => {
    await expect(
      service.propose("visitor-1", id, proposedStartsAt.toISOString()),
    ).rejects.toBeInstanceOf(ForbiddenException);
    const result = await service.propose(
      "owner-1",
      id,
      proposedStartsAt.toISOString(),
    );
    expect(result.status).toBe("counter_proposed");
    expect(result.proposedStartsAt).toEqual(proposedStartsAt);
    expect(result.proposalExpiresAt).toBeInstanceOf(Date);
    expect(getAccount).toHaveBeenCalledWith("acct_owner");
  });

  it("lets the visitor accept the proposed time before payment", async () => {
    findById.mockReturnValue({
      exec: async () => ({
        ...viewing,
        status: "counter_proposed",
        proposedStartsAt,
        proposalExpiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      }),
    });
    const result = await service.acceptProposal("visitor-1", id);
    expect(result.status).toBe("awaiting_payment");
    expect(result.startsAt).toEqual(proposedStartsAt);
    expect(findOneAndUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "counter_proposed",
        proposedStartsAt,
      }),
      expect.objectContaining({
        $set: expect.objectContaining({
          startsAt: proposedStartsAt,
          reservedSlot: `${id}-${proposedStartsAt.toISOString()}`,
        }),
      }),
      { new: true },
    );
  });

  it("does not accept an expired proposal", async () => {
    findById.mockReturnValue({
      exec: async () => ({
        ...viewing,
        status: "counter_proposed",
        proposedStartsAt,
        proposalExpiresAt: new Date(Date.now() - 1000),
      }),
    });
    await expect(
      service.acceptProposal("visitor-1", id),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(findOneAndUpdate).not.toHaveBeenCalled();
  });

  it("lets the visitor decline an unpaid proposal without a refund", async () => {
    findById.mockReturnValue({
      exec: async () => ({
        ...viewing,
        status: "counter_proposed",
        proposedStartsAt,
      }),
    });
    await expect(service.declineProposal("owner-1", id)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    const result = await service.declineProposal("visitor-1", id);
    expect(result.status).toBe("cancelled");
    expect(refundViewingPaymentIntent).not.toHaveBeenCalled();
  });

  it("refunds an owner cancellation if payment succeeded before the webhook", async () => {
    findById.mockReturnValue({
      exec: async () => ({
        ...viewing,
        status: "awaiting_payment",
        stripePaymentIntentId: "pi_paid",
        serviceFeeRon: 1,
      }),
    });
    getPaymentIntent.mockResolvedValue({ status: "succeeded" });
    refundViewingPaymentIntent.mockResolvedValue({ id: "re_paid", status: "succeeded" });
    findOneAndUpdate.mockImplementation((_filter, update) => ({
      exec: async () => ({
        ...viewing,
        stripePaymentIntentId: "pi_paid",
        serviceFeeRon: 1,
        ...update.$set,
      }),
    }));
    const result = await service.cancel("owner-1", id);
    expect(result?.status).toBe("cancelled");
    expect(refundViewingPaymentIntent).toHaveBeenCalledWith("pi_paid", false);
  });
});
