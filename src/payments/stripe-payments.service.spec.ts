import { StripePaymentsService } from "./stripe-payments.service";

describe("StripePaymentsService transaction setup", () => {
  const config = { get: jest.fn(() => undefined) };
  let service: StripePaymentsService;
  const createPayment = jest.fn();
  const createIdentity = jest.fn();
  const createEphemeralKey = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    service = new StripePaymentsService(config as any);
    (service as any).stripe = {
      paymentIntents: { create: createPayment },
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
