import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from "@nestjs/common";
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

  it("requires identity after Stripe reports payment succeeded", async () => {
    getPaymentIntent.mockResolvedValue({
      id: "pi_viewing",
      status: "succeeded",
    });
    await service.confirmPayment("visitor-1", viewingId);
    expect(updateOne).toHaveBeenCalledWith(
      { stripePaymentIntentId: "pi_viewing", status: "awaiting_payment" },
      { $set: { status: "awaiting_verification", paidAt: expect.any(Date) } },
    );
  });
});

describe("ViewingsService paid viewing order", () => {
  const id = "507f1f77bcf86cd799439011";
  const viewing = {
    _id: id,
    productId: id,
    visitorId: "visitor-1",
    ownerId: "owner-1",
    startsAt: new Date(Date.now() + 86400000),
    priceRon: 25,
    serviceFeeRon: 1,
    status: "awaiting_payment",
  };
  const findById = jest.fn();
  const exists = jest.fn();
  const findUserById = jest.fn();
  const createViewingPaymentIntent = jest.fn();
  const getAccount = jest.fn();
  const updateOne = jest.fn();
  const findOneAndUpdate = jest.fn();
  const service = new ViewingsService(
    { findById, exists, updateOne, findOneAndUpdate } as any,
    {} as any,
    { findById: findUserById } as any,
    { isLiveMode: () => false, createViewingPaymentIntent, getAccount } as any,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    findById.mockReturnValue({ exec: jest.fn().mockResolvedValue(viewing) });
    exists.mockResolvedValue(null);
    updateOne.mockReturnValue({ exec: jest.fn().mockResolvedValue({}) });
    findOneAndUpdate.mockReturnValue({
      exec: jest
        .fn()
        .mockResolvedValue({ ...viewing, status: "awaiting_payment" }),
    });
    getAccount.mockResolvedValue({ capabilities: { transfers: "active" } });
    createViewingPaymentIntent.mockResolvedValue({
      id: "pi_new",
      client_secret: "secret",
    });
  });

  it("accepts a paid viewing before the owner's document check", async () => {
    findById.mockReturnValue({
      exec: jest.fn().mockResolvedValue({ ...viewing, status: "requested" }),
    });
    findUserById.mockResolvedValue({
      id: "owner-1",
      stripeAccountId: "acct_123",
    });
    await expect(service.accept("owner-1", id)).resolves.toBeDefined();
    expect(createViewingPaymentIntent).not.toHaveBeenCalled();
  });

  it("charges the viewing price plus the same 5% rental commission before identity", async () => {
    await service.startPayment("visitor-1", id);
    expect(createViewingPaymentIntent).toHaveBeenCalledWith({
      viewingId: id,
      visitorId: "visitor-1",
      productId: id,
      amountRon: 26,
    });
  });

  it("does not confirm the viewing until both people are verified", async () => {
    findById.mockReturnValue({
      exec: jest
        .fn()
        .mockResolvedValue({ ...viewing, status: "awaiting_verification" }),
    });
    findUserById.mockImplementation(async (userId: string) =>
      userId === "visitor-1"
        ? { identityVerifiedAt: new Date(), identityVerificationMode: "test" }
        : { id: userId },
    );
    const result = await service.confirmIdentities("visitor-1", id);
    expect(result.status).toBe("awaiting_verification");
    expect(findOneAndUpdate).not.toHaveBeenCalled();
  });

  it("does not reuse a live identity result for a sandbox viewing", async () => {
    findById.mockReturnValue({
      exec: jest
        .fn()
        .mockResolvedValue({ ...viewing, status: "awaiting_verification" }),
    });
    findUserById.mockImplementation(async (userId: string) =>
      userId === "visitor-1"
        ? {
            id: userId,
            identityVerifiedAt: new Date(),
            identityVerificationMode: "live",
          }
        : { id: userId },
    );
    await expect(
      service.confirmIdentities("visitor-1", id),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("confirms the paid viewing only when both identity checks match this Stripe mode", async () => {
    findById.mockReturnValue({
      exec: jest
        .fn()
        .mockResolvedValue({ ...viewing, status: "awaiting_verification" }),
    });
    findUserById.mockResolvedValue({
      identityVerifiedAt: new Date(),
      identityVerificationMode: "test",
    });
    findOneAndUpdate.mockReturnValue({
      exec: jest.fn().mockResolvedValue({ ...viewing, status: "confirmed" }),
    });
    const result = await service.confirmIdentities("visitor-1", id);
    expect(result.status).toBe("confirmed");
    expect(findOneAndUpdate).toHaveBeenCalledWith(
      { _id: id, status: "awaiting_verification" },
      { $set: { status: "confirmed" } },
      { new: true },
    );
  });

  it("completes a free viewing without charging for identity checks", async () => {
    const freeViewing = {
      ...viewing,
      priceRon: 0,
      status: "confirmed",
      startsAt: new Date(Date.now() - 1000),
    };
    findById.mockReturnValue({
      exec: jest.fn().mockResolvedValue(freeViewing),
    });
    findOneAndUpdate.mockReturnValue({
      exec: jest
        .fn()
        .mockResolvedValue({ ...freeViewing, status: "completed" }),
    });
    await service.complete("owner-1", id);
    expect(findUserById).not.toHaveBeenCalled();
  });
});

describe("ViewingsService verification deadline", () => {
  it("refunds a captured viewing when identity is still missing after 48 hours", async () => {
    const id = "507f1f77bcf86cd799439011";
    const expired = {
      _id: id,
      visitorId: "visitor-1",
      ownerId: "owner-1",
      startsAt: new Date(Date.now() + 86400000),
      paidAt: new Date(Date.now() - 49 * 60 * 60 * 1000),
      status: "awaiting_verification",
      priceRon: 25,
      serviceFeeRon: 1,
      stripePaymentIntentId: "pi_expired",
    };
    const find = jest.fn().mockReturnValue({
      sort: () => ({ limit: () => ({ exec: async () => [expired] }) }),
    });
    const findOneAndUpdate = jest
      .fn()
      .mockReturnValueOnce({
        exec: async () => ({ ...expired, status: "refund_pending" }),
      })
      .mockReturnValueOnce({
        exec: async () => ({ ...expired, status: "cancelled" }),
      });
    const refundViewingPaymentIntent = jest
      .fn()
      .mockResolvedValue({ id: "re_expired", status: "succeeded" });
    const service = new ViewingsService(
      { find, findOneAndUpdate } as any,
      {} as any,
      { findById: async () => ({}) } as any,
      { isLiveMode: () => false, refundViewingPaymentIntent } as any,
    );
    await (service as any).reconcilePaidViewings();
    expect(refundViewingPaymentIntent).toHaveBeenCalledWith(
      "pi_expired",
      false,
    );
    expect(findOneAndUpdate).toHaveBeenNthCalledWith(
      1,
      { _id: id, status: "awaiting_verification" },
      { $set: { status: "refund_pending" } },
      { new: true },
    );
    expect(findOneAndUpdate).toHaveBeenNthCalledWith(
      2,
      { _id: id, status: "refund_pending" },
      expect.objectContaining({
        $set: expect.objectContaining({
          status: "cancelled",
          stripeRefundId: "re_expired",
        }),
      }),
      { new: true },
    );
  });
});
