import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  Post,
  Req,
  UnauthorizedException,
} from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { AuthService } from "../auth/auth.service";
import { Product, ProductDocument } from "../products/schemas/product.schema";
import {
  RentalOrder,
  RentalOrderDocument,
  RentalPaymentStatus,
  RentalPayoutStatus,
} from "../rental-orders/schemas/rental-order.schema";
import { UsersService } from "../users/users.service";
import { StripePaymentsService } from "./stripe-payments.service";
import { RequestPayoutDto } from "./dto/request-payout.dto";
import { Viewing, ViewingDocument } from "../viewings/schemas/viewing.schema";

@Controller("payments")
export class PaymentsController {
  constructor(
    private readonly stripePaymentsService: StripePaymentsService,
    private readonly authService: AuthService,
    private readonly usersService: UsersService,
    @InjectModel(Product.name)
    private readonly productModel: Model<ProductDocument>,
    @InjectModel(RentalOrder.name)
    private readonly rentalOrderModel: Model<RentalOrderDocument>,
    @InjectModel(Viewing.name)
    private readonly viewingModel: Model<ViewingDocument>,
  ) {}

  @Get("config")
  getConfig() {
    return this.stripePaymentsService.getConfig();
  }

  @Post("webhook")
  async webhook(
    @Req() request: any,
    @Headers("stripe-signature") signature: string,
  ) {
    const event = this.stripePaymentsService.constructWebhookEvent(
      request.rawBody ?? request.body,
      signature,
    );
    const object = event.data.object as any;
    if (
      event.type === "payment_intent.succeeded" &&
      object.metadata?.viewingId
    ) {
      await this.viewingModel
        .updateOne(
          {
            _id: object.metadata.viewingId,
            stripePaymentIntentId: object.id,
            status: "awaiting_payment",
          },
          { $set: { status: "awaiting_verification", paidAt: new Date() } },
        )
        .exec();
    }
    if (event.type === "refund.updated" && object.payment_intent) {
      await this.viewingModel
        .updateOne(
          {
            stripePaymentIntentId: object.payment_intent,
            stripeRefundId: object.id,
          },
          { $set: { refundStatus: object.status } },
        )
        .exec();
    }
    if (event.type === "identity.verification_session.verified") {
      await this.usersService.markIdentityVerified(object.id);
    }
    if (event.type === "refund.updated" && object.payment_intent) {
      const paymentStatus =
        object.status === "succeeded"
          ? RentalPaymentStatus.Refunded
          : object.status === "failed"
            ? RentalPaymentStatus.Failed
            : RentalPaymentStatus.Processing;
      await this.rentalOrderModel
        .updateOne(
          { stripePaymentIntentId: object.payment_intent, status: "rejected" },
          { $set: { paymentStatus, refundStatus: object.status } },
        )
        .exec();
    }
    const orderId = object.metadata?.rentalOrderId;
    if (orderId) {
      const update: Record<string, unknown> = {};
      if (event.type === "payment_intent.payment_failed") {
        update.paymentStatus = RentalPaymentStatus.Failed;
      } else if (event.type === "payment_intent.amount_capturable_updated") {
        update.paymentStatus = RentalPaymentStatus.Authorized;
        update.authorizationExpiresAt = new Date(
          (event.created + 48 * 60 * 60) * 1000,
        );
      } else if (event.type === "payment_intent.succeeded") {
        update.paymentStatus = RentalPaymentStatus.Captured;
      } else if (event.type === "payment_intent.canceled") {
        update.paymentStatus = RentalPaymentStatus.Cancelled;
        update.status = "rejected";
      } else if (event.type === "charge.refunded") {
        update.paymentStatus = RentalPaymentStatus.Refunded;
      }
      if (Object.keys(update).length) {
        const filter: Record<string, unknown> = { _id: orderId };
        if (event.type === "payment_intent.amount_capturable_updated") {
          filter.status = "pending";
          filter.paymentStatus = {
            $nin: [
              RentalPaymentStatus.Captured,
              RentalPaymentStatus.Refunded,
              RentalPaymentStatus.Cancelled,
            ],
          };
        }
        await this.rentalOrderModel.updateOne(filter, { $set: update }).exec();
      }
    }
    return { received: true };
  }

  @Post("identity/start")
  async startIdentity(@Headers("authorization") authorization?: string) {
    const userId = this.getUserId(authorization);
    const state = await this.usersService.getVerificationState(userId);
    if (!state) throw new UnauthorizedException();
    const mode = this.stripePaymentsService.isLiveMode() ? "live" : "test";
    if (state.identityVerifiedAt && state.identityVerificationMode === mode) {
      return { verified: true, url: "" };
    }
    await this.assertIdentityEligible(userId);
    if (
      state.identityVerificationSessionId &&
      state.identityVerificationMode === mode
    ) {
      const existing = await this.stripePaymentsService.getIdentitySession(
        state.identityVerificationSessionId,
      );
      if (existing.status === "verified") {
        await this.usersService.markIdentityVerified(existing.id);
        return { verified: true, url: "" };
      }
      if (existing.status === "requires_input" && existing.url) {
        return { verified: false, url: existing.url };
      }
      if (existing.status === "processing") {
        return { verified: false, url: "", processing: true };
      }
    }
    const session = await this.stripePaymentsService.createIdentitySession(
      userId,
      state.email,
    );
    await this.usersService.setIdentitySession(userId, session.id, mode);
    return { verified: false, url: session.url };
  }

  @Post("identity/native/start")
  async startNativeIdentity(@Headers("authorization") authorization?: string) {
    const result = await this.startIdentity(authorization);
    if (result.verified || result.processing) return result;
    const userId = this.getUserId(authorization);
    const state = await this.usersService.getVerificationState(userId);
    const sessionId = state?.identityVerificationSessionId;
    if (!sessionId || !result.url) {
      throw new BadRequestException(
        "Sesiunea Stripe Identity nu este disponibila.",
      );
    }
    const ephemeralKeySecret =
      await this.stripePaymentsService.createIdentityEphemeralKey(sessionId);
    return { verified: false, sessionId, ephemeralKeySecret };
  }

  @Get("identity/status")
  async identityStatus(@Headers("authorization") authorization?: string) {
    const userId = this.getUserId(authorization);
    const state = await this.usersService.getVerificationState(userId);
    if (!state) throw new UnauthorizedException();
    const mode = this.stripePaymentsService.isLiveMode() ? "live" : "test";
    if (
      state.identityVerificationSessionId &&
      state.identityVerificationMode === mode &&
      !state.identityVerifiedAt
    ) {
      const session = await this.stripePaymentsService.getIdentitySession(
        state.identityVerificationSessionId,
      );
      if (session.status === "verified") {
        await this.usersService.markIdentityVerified(session.id);
        state.identityVerifiedAt = new Date();
      }
    }
    return {
      identityVerified: Boolean(
        state.identityVerifiedAt && state.identityVerificationMode === mode,
      ),
    };
  }

  @Post("connect/onboarding-link")
  async createConnectOnboardingLink(
    @Headers("authorization") authorization: string | undefined,
  ) {
    const userId = this.getUserId(authorization);
    const user = await this.authService.getProfile(userId);
    let accountId = user.stripeAccountId;

    if (!accountId) {
      const account = await this.stripePaymentsService.createExpressAccount({
        email: user.email,
        fullName: user.fullName,
        phone: user.phone,
        city: user.city,
        businessType: "individual",
      });
      accountId = account.id;
      await this.usersService.updateStripeAccount({
        userId,
        stripeAccountId: accountId,
      });
    }

    const link = await this.stripePaymentsService.createAccountLink({
      accountId,
    });

    return { url: link.url };
  }

  @Post("payouts/request")
  async requestPayout(
    @Headers("authorization") authorization: string | undefined,
    @Body() requestPayoutDto: RequestPayoutDto,
  ) {
    const userId = this.getUserId(authorization);
    const user = await this.authService.getProfile(userId);
    let accountId = user.stripeAccountId;

    if (!accountId) {
      const account = await this.stripePaymentsService.createExpressAccount({
        email: user.email,
        fullName: user.fullName,
        phone: user.phone,
        city: user.city,
        businessType: requestPayoutDto.businessType ?? "individual",
      });
      accountId = account.id;
      await this.usersService.updateStripeAccount({
        userId,
        stripeAccountId: accountId,
      });
    }

    const account = await this.stripePaymentsService.getAccount(accountId);
    await this.usersService.updateStripeAccount({
      userId,
      stripeAccountId: accountId,
      stripePayoutsEnabled: account.payouts_enabled,
      stripeDetailsSubmitted: account.details_submitted,
    });

    if (!account.payouts_enabled || !account.details_submitted) {
      const link = await this.stripePaymentsService.createAccountLink({
        accountId,
      });

      return {
        status: "requires_onboarding",
        url: link.url,
      };
    }

    const productIds = await this.findOwnedProductIds(user.id, user.fullName);
    await this.rentalOrderModel
      .updateMany(
        {
          productId: { $in: productIds },
          payoutStatus: RentalPayoutStatus.HeldUntilReturn,
          payoutEligibleAt: { $lte: new Date() },
        },
        { payoutStatus: RentalPayoutStatus.Eligible },
      )
      .exec();
    const payableOrders = await this.rentalOrderModel
      .find({
        productId: { $in: productIds },
        paymentStatus: RentalPaymentStatus.Captured,
        status: "completed",
        payoutStatus: RentalPayoutStatus.Eligible,
        payoutEligibleAt: { $lte: new Date() },
        stripeTransferId: { $exists: false },
      })
      .exec();
    const amount = payableOrders.reduce(
      (sum, order) => sum + order.ownerEarnings,
      0,
    );

    if (amount <= 0) {
      throw new BadRequestException("Nu exista bani disponibili pentru plata.");
    }

    const transfer = await this.stripePaymentsService.createTransfer({
      amountRon: amount,
      destinationAccountId: accountId,
      userId,
    });

    await this.rentalOrderModel
      .updateMany(
        {
          _id: { $in: payableOrders.map((order) => order._id) },
          stripeTransferId: { $exists: false },
        },
        {
          payoutStatus: RentalPayoutStatus.PaidOut,
          stripeTransferId: transfer.id,
        },
      )
      .exec();

    return {
      status: "paid_out",
      amount,
      transferId: transfer.id,
    };
  }

  private async findOwnedProductIds(ownerId: string, ownerName: string) {
    const products = await this.productModel
      .find({ $or: [{ ownerId }, { ownerName }] })
      .select("_id")
      .exec();

    return products.map((product) => product._id);
  }

  private async assertIdentityEligible(userId: string) {
    const paidViewing = await this.viewingModel.exists({
      status: "awaiting_verification",
      paidAt: { $exists: true },
      $or: [{ visitorId: userId }, { ownerId: userId }],
    });
    if (paidViewing) return;
    const renterOrder = await this.rentalOrderModel.exists({
      renterId: userId,
      status: "pending",
      paymentStatus: RentalPaymentStatus.Authorized,
    });
    if (renterOrder) return;
    const profile = await this.authService.getProfile(userId);
    const productIds = await this.findOwnedProductIds(userId, profile.fullName);
    const ownerOrder = await this.rentalOrderModel.exists({
      productId: { $in: productIds },
      status: "pending",
      paymentStatus: RentalPaymentStatus.Authorized,
    });
    if (!ownerOrder) {
      throw new BadRequestException(
        "Verificarea identitatii se deschide dupa plata vizionarii sau autorizarea unei inchirieri.",
      );
    }
  }

  private getUserId(authorization?: string): string {
    const [type, token] = authorization?.split(" ") ?? [];

    if (type !== "Bearer" || !token) {
      throw new UnauthorizedException("Lipseste tokenul de autentificare.");
    }

    const payload = this.authService.verifyToken(token);
    return payload.sub;
  }
}
