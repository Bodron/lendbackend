import { BadRequestException, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import Stripe = require("stripe");

@Injectable()
export class StripePaymentsService {
  private readonly stripe: Stripe | null;
  private readonly publishableKey?: string;

  constructor(private readonly configService: ConfigService) {
    const secretKey = this.configService.get<string>("STRIPE_SECRET_KEY");
    this.publishableKey = this.configService.get<string>(
      "STRIPE_PUBLISHABLE_KEY",
    );
    this.stripe = secretKey
      ? new Stripe(secretKey, { apiVersion: "2026-07-29.dahlia" })
      : null;
  }

  getConfig() {
    return {
      publishableKey: this.publishableKey ?? "",
    };
  }

  isLiveMode() {
    return (
      this.configService
        .get<string>("STRIPE_SECRET_KEY")
        ?.startsWith("sk_live_") ?? false
    );
  }

  assertVerificationConfigured() {
    if (!this.configService.get<string>("STRIPE_SECRET_KEY")) {
      throw new BadRequestException(
        "Verificarea identitatii prin Stripe nu este configurata. Plata nu a fost pornita.",
      );
    }
  }

  constructWebhookEvent(payload: Buffer | string, signature: string) {
    const secret = this.configService.get<string>("STRIPE_WEBHOOK_SECRET");
    if (!secret) {
      throw new BadRequestException(
        "Stripe webhook secret nu este configurat.",
      );
    }
    return this.getStripe().webhooks.constructEvent(payload, signature, secret);
  }

  async createManualCapturePaymentIntent(input: {
    amountRon: number;
    orderId: string;
    renterId: string;
    productId: string;
  }) {
    const stripe = this.getStripe();

    return stripe.paymentIntents.create({
      amount: this.toMinorUnits(input.amountRon),
      currency: "ron",
      capture_method: "manual",
      payment_method_types: ["card"],
      metadata: {
        rentalOrderId: input.orderId,
        renterId: input.renterId,
        productId: input.productId,
      },
      transfer_group: `rental_${input.orderId}`,
    });
  }

  async capturePaymentIntent(paymentIntentId: string) {
    return this.getStripe().paymentIntents.capture(paymentIntentId);
  }

  async getPaymentIntent(paymentIntentId: string) {
    return this.getStripe().paymentIntents.retrieve(paymentIntentId);
  }

  async cancelPaymentIntent(paymentIntentId: string) {
    return this.getStripe().paymentIntents.cancel(paymentIntentId);
  }

  async refundPaymentIntent(paymentIntentId: string) {
    return this.getStripe().refunds.create(
      { payment_intent: paymentIntentId },
      { idempotencyKey: `rental-refund-${paymentIntentId}` },
    );
  }

  async createIdentitySession(userId: string, email: string) {
    return this.getStripe().identity.verificationSessions.create({
      type: "document",
      client_reference_id: userId,
      provided_details: { email },
      options: { document: { require_matching_selfie: true } },
      metadata: { userId },
    });
  }

  async getIdentitySession(sessionId: string) {
    return this.getStripe().identity.verificationSessions.retrieve(sessionId);
  }

  async createIdentityEphemeralKey(sessionId: string) {
    const key = await this.getStripe().ephemeralKeys.create(
      { verification_session: sessionId },
      { apiVersion: "2026-08-26.dahlia" },
    );
    if (!key.secret) {
      throw new BadRequestException("Cheia temporara Stripe Identity lipseste.");
    }
    return key.secret;
  }

  async createExpressAccount(input: {
    email: string;
    fullName: string;
    phone: string;
    city?: string;
    businessType: "individual" | "company";
  }) {
    const nameParts = input.fullName.trim().split(/\s+/);
    const firstName = nameParts.shift() ?? input.fullName;
    const lastName = nameParts.join(" ") || firstName;

    return this.getStripe().accounts.create({
      type: "express",
      email: input.email,
      country: "RO",
      business_type: input.businessType,
      ...(input.businessType === "individual"
        ? {
            individual: {
              first_name: firstName,
              last_name: lastName,
              email: input.email,
              phone: input.phone,
              ...(input.city
                ? { address: { city: input.city, country: "RO" } }
                : {}),
            },
          }
        : { company: { phone: input.phone } }),
      capabilities: {
        transfers: { requested: true },
      },
    });
  }

  async createAccountLink(input: { accountId: string }) {
    const baseUrl = this.getPublicBaseUrl();

    return this.getStripe().accountLinks.create({
      account: input.accountId,
      type: "account_onboarding",
      refresh_url: `${baseUrl}/stripe/connect/refresh`,
      return_url: `${baseUrl}/stripe/connect/return`,
    });
  }

  private getPublicBaseUrl(): string {
    const configuredUrl =
      this.configService.get<string>("APP_PUBLIC_URL") ??
      this.configService.get<string>("APP_BASE_URL") ??
      this.configService.get<string>("APP_BASE_URL_DEV");

    if (!configuredUrl) {
      throw new BadRequestException(
        "Lipseste APP_PUBLIC_URL pentru linkurile Stripe Connect.",
      );
    }

    return configuredUrl
      .trim()
      .replace(/\/api\/?$/, "")
      .replace(/\/$/, "");
  }

  async getAccount(accountId: string) {
    return this.getStripe().accounts.retrieve(accountId);
  }

  async createTransfer(input: {
    amountRon: number;
    destinationAccountId: string;
    userId: string;
  }) {
    return this.getStripe().transfers.create({
      amount: this.toMinorUnits(input.amountRon),
      currency: "ron",
      destination: input.destinationAccountId,
      metadata: {
        ownerId: input.userId,
      },
    });
  }

  private getStripe(): Stripe {
    if (!this.stripe) {
      throw new BadRequestException(
        "Stripe nu este configurat. Adauga STRIPE_SECRET_KEY in .env.",
      );
    }

    return this.stripe;
  }

  private toMinorUnits(amountRon: number): number {
    return Math.max(50, Math.round(amountRon * 100));
  }
}
