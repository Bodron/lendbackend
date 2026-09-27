import { PaymentsController } from "./payments.controller";

jest.mock("../auth/auth.service", () => ({ AuthService: class {} }));

describe("PaymentsController identity verification", () => {
  const stripe = {
    isLiveMode: jest.fn(() => false),
    createIdentitySession: jest.fn(),
    getIdentitySession: jest.fn(),
    getAccount: jest.fn(),
    createExpressAccount: jest.fn(),
    createAccountLink: jest.fn(),
    createExpressLoginLink: jest.fn(),
  };
  const auth = {
    verifyToken: jest.fn(() => ({ sub: "user-1" })),
    getProfile: jest.fn(),
  };
  const users = {
    getVerificationState: jest.fn(),
    setIdentitySession: jest.fn(),
    markIdentityVerified: jest.fn(),
    updateStripeAccount: jest.fn(),
  };
  const products = { find: jest.fn() };
  const orders = { exists: jest.fn() };
  const viewings = { exists: jest.fn() };

  const controller = new PaymentsController(
    stripe as any,
    auth as any,
    users as any,
    products as any,
    orders as any,
    viewings as any,
  );

  beforeEach(() => jest.clearAllMocks());

  it("starts Stripe Identity from the profile without an active transaction", async () => {
    users.getVerificationState.mockResolvedValue({ email: "user@example.com" });
    stripe.createIdentitySession.mockResolvedValue({
      id: "vs_123",
      url: "https://verify.stripe.com/test",
    });

    await expect(controller.startIdentity("Bearer token")).resolves.toEqual({
      verified: false,
      url: "https://verify.stripe.com/test",
    });
    expect(stripe.createIdentitySession).toHaveBeenCalledWith(
      "user-1",
      "user@example.com",
    );
    expect(users.setIdentitySession).toHaveBeenCalledWith(
      "user-1",
      "vs_123",
      "test",
    );
    expect(orders.exists).not.toHaveBeenCalled();
    expect(viewings.exists).not.toHaveBeenCalled();
  });

  it("reports a submitted session as processing", async () => {
    users.getVerificationState.mockResolvedValue({
      identityVerificationSessionId: "vs_123",
      identityVerificationMode: "test",
    });
    stripe.getIdentitySession.mockResolvedValue({
      id: "vs_123",
      status: "processing",
    });

    await expect(controller.identityStatus("Bearer token")).resolves.toEqual({
      identityVerified: false,
      processing: true,
    });
  });

  it("reports an unconnected payout account without creating one", async () => {
    auth.getProfile.mockResolvedValue({ stripeAccountId: null });
    await expect(controller.connectStatus("Bearer token")).resolves.toEqual({
      connected: false,
      payoutsEnabled: false,
      detailsSubmitted: false,
      currentlyDue: 0,
      pastDue: 0,
      pendingVerification: 0,
      errors: [],
    });
    expect(stripe.createExpressAccount).not.toHaveBeenCalled();
  });

  it("reads requirements from Stripe and syncs the payout flags", async () => {
    auth.getProfile.mockResolvedValue({ stripeAccountId: "acct_123" });
    stripe.getAccount.mockResolvedValue({
      payouts_enabled: false,
      details_submitted: true,
      requirements: {
        currently_due: ["external_account"],
        past_due: [],
        pending_verification: [],
        errors: [{ reason: "Bank account details need updating" }],
      },
    });
    await expect(controller.connectStatus("Bearer token")).resolves.toEqual({
      connected: true,
      payoutsEnabled: false,
      detailsSubmitted: true,
      currentlyDue: 1,
      pastDue: 0,
      pendingVerification: 0,
      errors: ["Bank account details need updating"],
    });
    expect(users.updateStripeAccount).toHaveBeenCalledWith({
      userId: "user-1",
      stripeAccountId: "acct_123",
      stripePayoutsEnabled: false,
      stripeDetailsSubmitted: true,
    });
  });

  it("creates a company account when selected from payout settings", async () => {
    auth.getProfile.mockResolvedValue({
      stripeAccountId: null,
      email: "user@example.com",
      fullName: "Test User",
      phone: "0700000000",
    });
    stripe.createExpressAccount.mockResolvedValue({ id: "acct_company" });
    stripe.createAccountLink.mockResolvedValue({ url: "https://connect.stripe.com" });
    await controller.createConnectOnboardingLink("Bearer token", {
      businessType: "company",
    });
    expect(stripe.createExpressAccount).toHaveBeenCalledWith(
      expect.objectContaining({ businessType: "company" }),
    );
  });
});
