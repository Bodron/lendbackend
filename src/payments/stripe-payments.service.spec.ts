import { StripePaymentsService } from "./stripe-payments.service";

describe("StripePaymentsService transaction setup", () => {
  const config = { get: jest.fn(() => undefined) };
  let service: StripePaymentsService;
  const createPayment = jest.fn();
  const createIdentity = jest.fn();
  const createEphemeralKey = jest.fn();
  const retrievePayment = jest.fn();
  const createTransfer = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    service = new StripePaymentsService(config as any);
    (service as any).stripe = {
      paymentIntents: { create: createPayment, retrieve: retrievePayment },
      transfers: { create: createTransfer },
      identity: { verificationSessions: { create: createIdentity } },
      ephemeralKeys: { create: createEphemeralKey },
    };
  });

  it("authorizes card payments for later capture", async () => {
    createPayment.mockResolvedValue({ id: "pi_test" });
    await service.createManualCapturePaymentIntent({
      amountRon: 125,
      orderId: "order-1",
      renterId: "renter-1",
      productId: "product-1",
    });
    expect(createPayment).toHaveBeenCalledWith(
      expect.objectContaining({
        amount: 12500,
        currency: "ron",
        capture_method: "manual",
        payment_method_types: ["card"],
      }),
    );
  });

  it("requires an ID document with a matching selfie", async () => {
    createIdentity.mockResolvedValue({ id: "vs_test" });
    await service.createIdentitySession("user-1", "test@example.com");
    expect(createIdentity).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "document",
        client_reference_id: "user-1",
        options: { document: { require_matching_selfie: true } },
      }),
    );
  });

  it("captures a paid viewing on the platform before either identity check", async () => {
    createPayment.mockResolvedValue({ id: "pi_viewing" });
    await service.createViewingPaymentIntent({
      viewingId: "view-1",
      visitorId: "visitor-1",
      productId: "product-1",
      amountRon: 26,
    });
    expect(createPayment).toHaveBeenCalledWith(
      expect.objectContaining({
        amount: 2600,
        currency: "ron",
        transfer_group: "viewing_view-1",
      }),
      { idempotencyKey: "viewing-payment-v2-view-1" },
    );
    expect(createPayment.mock.calls[0][0].transfer_data).toBeUndefined();
  });

  it("transfers only the owner's price after the viewing is complete", async () => {
    retrievePayment.mockResolvedValue({
      status: "succeeded",
      latest_charge: "ch_viewing",
    });
    createTransfer.mockResolvedValue({ id: "tr_viewing" });
    await service.transferViewingPayment({
      viewingId: "view-1",
      paymentIntentId: "pi_viewing",
      amountRon: 25,
      destinationAccountId: "acct_owner",
    });
    expect(createTransfer).toHaveBeenCalledWith(
      expect.objectContaining({
        amount: 2500,
        destination: "acct_owner",
        source_transaction: "ch_viewing",
      }),
      { idempotencyKey: "viewing-transfer-view-1" },
    );
  });

  it("binds a short-lived native key to the identity session", async () => {
    createEphemeralKey.mockResolvedValue({ secret: "ek_test" });
    const secret = await service.createIdentityEphemeralKey("vs_test");
    expect(secret).toBe("ek_test");
    expect(createEphemeralKey).toHaveBeenCalledWith(
      { verification_session: "vs_test" },
      { apiVersion: "2026-08-26.dahlia" },
    );
  });
});
