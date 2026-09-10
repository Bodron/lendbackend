import {
  BadRequestException,
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
    const orderId = object.metadata?.rentalOrderId;
    if (orderId) {
      const update: Record<string, unknown> = {};
      if (event.type === "payment_intent.payment_failed") {
        update.paymentStatus = RentalPaymentStatus.Failed;
      } else if (event.type === "payment_intent.amount_capturable_updated") {
        update.paymentStatus = RentalPaymentStatus.Authorized;
      } else if (event.type === "payment_intent.succeeded") {
        update.paymentStatus = RentalPaymentStatus.Captured;
      } else if (event.type === "charge.refunded") {
        update.paymentStatus = RentalPaymentStatus.Refunded;
      }
      if (Object.keys(update).length) {
        await this.rentalOrderModel
          .updateOne({ _id: orderId }, { $set: update })
          .exec();
      }
    }
    return { received: true };
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
  ) {
    const userId = this.getUserId(authorization);
    const user = await this.authService.getProfile(userId);
    let accountId = user.stripeAccountId;

    if (!accountId) {
      const account = await this.stripePaymentsService.createExpressAccount({
        email: user.email,
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
    await this.rentalOrderModel.updateMany(
      {
        productId: { $in: productIds },
        payoutStatus: RentalPayoutStatus.HeldUntilReturn,
        payoutEligibleAt: { $lte: new Date() },
      },
      { payoutStatus: RentalPayoutStatus.Eligible },
    ).exec();
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

    await this.rentalOrderModel.updateMany(
      { _id: { $in: payableOrders.map((order) => order._id) }, stripeTransferId: { $exists: false } },
      { payoutStatus: RentalPayoutStatus.PaidOut, stripeTransferId: transfer.id },
    ).exec();

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

  private getUserId(authorization?: string): string {
    const [type, token] = authorization?.split(" ") ?? [];

    if (type !== "Bearer" || !token) {
      throw new UnauthorizedException("Lipseste tokenul de autentificare.");
    }

    const payload = this.authService.verifyToken(token);
    return payload.sub;
  }
}
