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

  constructWebhookEvent(payload: Buffer | string, signature: string) {
    const secret = this.configService.get<string>("STRIPE_WEBHOOK_SECRET");
    if (!secret) {
      throw new BadRequestException("Stripe webhook secret nu este configurat.");
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
      automatic_payment_methods: { enabled: true },
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

  async createExpressAccount(input: { email: string }) {
    return this.getStripe().accounts.create({
      type: "express",
      email: input.email,
      capabilities: {
        transfers: { requested: true },
      },
    });
  }

  async createAccountLink(input: { accountId: string }) {
    const baseUrl = this.configService.get<string>(
      "APP_PUBLIC_URL",
      "http://localhost:3000",
    );

    return this.getStripe().accountLinks.create({
      account: input.accountId,
      type: "account_onboarding",
      refresh_url: `${baseUrl}/stripe/connect/refresh`,
      return_url: `${baseUrl}/stripe/connect/return`,
    });
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
