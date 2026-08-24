import {
  BadRequestException,
  Controller,
  Get,
  Headers,
  Post,
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
    const payableOrders = await this.rentalOrderModel
      .find({
        productId: { $in: productIds },
        paymentStatus: RentalPaymentStatus.Captured,
        payoutStatus: { $ne: RentalPayoutStatus.PaidOut },
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
        { _id: { $in: payableOrders.map((order) => order._id) } },
        { payoutStatus: RentalPayoutStatus.PaidOut },
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

  private getUserId(authorization?: string): string {
    const [type, token] = authorization?.split(" ") ?? [];

    if (type !== "Bearer" || !token) {
      throw new UnauthorizedException("Lipseste tokenul de autentificare.");
    }

    const payload = this.authService.verifyToken(token);
    return payload.sub;
  }
}
