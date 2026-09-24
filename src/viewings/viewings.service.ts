import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model, Types } from "mongoose";
import { StripePaymentsService } from "../payments/stripe-payments.service";
import { Product, ProductDocument } from "../products/schemas/product.schema";
import { UsersService } from "../users/users.service";
import { RequestViewingDto } from "./dto/request-viewing.dto";
import { Viewing, ViewingDocument } from "./schemas/viewing.schema";

@Injectable()
export class ViewingsService {
  constructor(
    @InjectModel(Viewing.name)
    private readonly viewingModel: Model<ViewingDocument>,
    @InjectModel(Product.name)
    private readonly productModel: Model<ProductDocument>,
    private readonly usersService: UsersService,
    private readonly stripePaymentsService: StripePaymentsService,
  ) {}

  async request(visitorId: string, dto: RequestViewingDto) {
    const product = await this.productModel.findById(dto.productId).exec();
    if (
      !product ||
      product.categorySlug !== "imobiliare" ||
      !product.viewingsEnabled ||
      !product.isAvailable
    ) {
      throw new BadRequestException("Acest anunt nu accepta vizionari.");
    }
    if (!product.ownerId) {
      throw new BadRequestException(
        "Proprietarul trebuie sa isi actualizeze anuntul inainte de programarea vizionarilor.",
      );
    }
    const visitor = await this.usersService.findById(visitorId);
    if (!visitor) throw new ForbiddenException();
    if (product.ownerId === visitorId)
      throw new BadRequestException(
        "Nu poti programa vizionarea propriului anunt.",
      );
    const startsAt = new Date(dto.startsAt);
    if (
      !Number.isFinite(startsAt.getTime()) ||
      startsAt.getTime() < Date.now() + 60 * 60 * 1000 ||
      startsAt.getTime() > Date.now() + 90 * 24 * 60 * 60 * 1000
    ) {
      throw new BadRequestException(
        "Alege o data intre o ora si 90 de zile de acum.",
      );
    }
    const duplicate = await this.viewingModel.exists({
      productId: product._id,
      visitorId,
      startsAt,
      status: { $in: ["requested", "awaiting_payment", "confirmed"] },
    });
    if (duplicate)
      throw new ConflictException("Ai deja o cerere pentru aceasta ora.");
    return this.viewingModel.create({
      productId: product._id,
      productTitle: product.title,
      ownerId: product.ownerId,
      visitorId,
      visitorName: visitor.fullName,
      startsAt,
      status: "requested",
      priceRon: product.viewingPriceRon ?? 0,
    });
  }

  async mine(userId: string) {
    return this.viewingModel
      .find({ $or: [{ visitorId: userId }, { ownerId: userId }] })
      .sort({ startsAt: -1 })
      .limit(100)
      .exec();
  }

  async accept(ownerId: string, id: string) {
    const viewing = await this.find(id);
    if (viewing.ownerId !== ownerId) throw new ForbiddenException();
    if (viewing.status !== "requested")
      throw new ConflictException("Cererea nu mai poate fi acceptata.");
    if (viewing.startsAt.getTime() <= Date.now())
      throw new ConflictException("Ora vizionarii a trecut.");
    const overlapping = await this.viewingModel.exists({
      _id: { $ne: viewing._id },
      productId: viewing.productId,
      startsAt: viewing.startsAt,
      status: { $in: ["awaiting_payment", "confirmed"] },
    });
    if (overlapping)
      throw new ConflictException("Aceasta ora este deja rezervata.");
    if (viewing.priceRon > 0) {
      const owner = await this.usersService.findById(ownerId);
      if (!owner?.stripeAccountId)
        throw new BadRequestException(
          "Configureaza Stripe Connect inainte de a accepta o vizionare cu plata.",
        );
      const account = await this.stripePaymentsService.getAccount(
        owner.stripeAccountId,
      );
      if (account.capabilities?.transfers !== "active")
        throw new BadRequestException(
          "Contul Stripe Connect nu este inca pregatit sa primeasca plati.",
        );
    }
    const status = viewing.priceRon > 0 ? "awaiting_payment" : "confirmed";
    let updated: ViewingDocument | null;
    try {
      updated = await this.viewingModel
        .findOneAndUpdate(
          { _id: viewing._id, status: "requested" },
          {
            $set: {
              status,
              reservedSlot: `${viewing.productId}-${viewing.startsAt.toISOString()}`,
            },
          },
          { new: true },
        )
        .exec();
    } catch (error) {
      if ((error as { code?: number }).code === 11000)
        throw new ConflictException("Aceasta ora este deja rezervata.");
      throw error;
    }
    if (!updated)
      throw new ConflictException("Cererea a fost deja modificata.");
    return updated;
  }

  async reject(ownerId: string, id: string) {
    const viewing = await this.find(id);
    if (viewing.ownerId !== ownerId) throw new ForbiddenException();
    const updated = await this.viewingModel
      .findOneAndUpdate(
        { _id: viewing._id, status: "requested" },
        { $set: { status: "rejected" } },
        { new: true },
      )
      .exec();
    if (!updated)
      throw new ConflictException("Cererea nu mai poate fi respinsa.");
    return updated;
  }

  async complete(ownerId: string, id: string) {
    const viewing = await this.find(id);
    if (viewing.ownerId !== ownerId) throw new ForbiddenException();
    if (
      viewing.status !== "confirmed" ||
      viewing.startsAt.getTime() > Date.now()
    ) {
      throw new ConflictException(
        "Vizionarea poate fi finalizata doar dupa ora programata.",
      );
    }
    return this.viewingModel
      .findOneAndUpdate(
        { _id: viewing._id, status: "confirmed" },
        { $set: { status: "completed" }, $unset: { reservedSlot: "" } },
        { new: true },
      )
      .exec();
  }

  async cancel(userId: string, id: string) {
    const viewing = await this.find(id);
    if (viewing.ownerId !== userId && viewing.visitorId !== userId)
      throw new ForbiddenException();
    if (
      viewing.status === "confirmed" &&
      viewing.startsAt.getTime() > Date.now()
    ) {
      if (viewing.priceRon > 0) {
        if (viewing.ownerId !== userId)
          throw new ConflictException(
            "Vizionarea platita poate fi anulata doar de proprietar. Contacteaza suportul pentru o problema cu vizionarea.",
          );
        if (!viewing.stripePaymentIntentId)
          throw new ConflictException("Plata vizionarii nu a fost gasita.");
        const refund =
          await this.stripePaymentsService.refundViewingPaymentIntent(
            viewing.stripePaymentIntentId,
          );
        return this.viewingModel
          .findOneAndUpdate(
            { _id: viewing._id, status: "confirmed" },
            {
              $set: {
                status: "cancelled",
                stripeRefundId: refund.id,
                refundStatus: refund.status,
              },
              $unset: { reservedSlot: "" },
            },
            { new: true },
          )
          .exec();
      }
      return this.viewingModel
        .findOneAndUpdate(
          { _id: viewing._id, status: "confirmed" },
          { $set: { status: "cancelled" }, $unset: { reservedSlot: "" } },
          { new: true },
        )
        .exec();
    }
    if (!["requested", "awaiting_payment"].includes(viewing.status))
      throw new ConflictException("Vizionarea nu mai poate fi anulata.");
    if (viewing.stripePaymentIntentId) {
      const intent = await this.stripePaymentsService.getPaymentIntent(
        viewing.stripePaymentIntentId,
      );
      if (intent.status === "succeeded")
        throw new ConflictException(
          "Plata a fost incasata. Contacteaza suportul pentru anulare.",
        );
      if (intent.status !== "canceled") {
        await this.stripePaymentsService.cancelPaymentIntent(intent.id);
      }
    }
    return this.viewingModel
      .findOneAndUpdate(
        {
          _id: viewing._id,
          status: { $in: ["requested", "awaiting_payment"] },
        },
        { $set: { status: "cancelled" }, $unset: { reservedSlot: "" } },
        { new: true },
      )
      .exec();
  }

  async startPayment(visitorId: string, id: string) {
    const viewing = await this.find(id);
    if (viewing.visitorId !== visitorId) throw new ForbiddenException();
    if (viewing.status !== "awaiting_payment" || viewing.priceRon <= 0)
      throw new ConflictException("Vizionarea nu asteapta plata.");
    if (viewing.startsAt.getTime() <= Date.now())
      throw new ConflictException("Ora vizionarii a trecut.");
    if (viewing.stripePaymentIntentId) {
      const intent = await this.stripePaymentsService.getPaymentIntent(
        viewing.stripePaymentIntentId,
      );
      if (intent.status === "succeeded") {
        await this.markPaid(intent.id);
        return { clientSecret: "", confirmed: true };
      }
      return { clientSecret: intent.client_secret ?? "", confirmed: false };
    }
    const owner = await this.usersService.findById(viewing.ownerId);
    if (!owner?.stripeAccountId)
      throw new BadRequestException(
        "Contul de plata al proprietarului nu este disponibil.",
      );
    const intent = await this.stripePaymentsService.createViewingPaymentIntent({
      viewingId: id,
      visitorId,
      productId: viewing.productId.toString(),
      amountRon: viewing.priceRon,
      destinationAccountId: owner.stripeAccountId,
    });
    await this.viewingModel
      .updateOne(
        { _id: viewing._id, status: "awaiting_payment" },
        { $set: { stripePaymentIntentId: intent.id } },
      )
      .exec();
    return { clientSecret: intent.client_secret ?? "", confirmed: false };
  }

  async confirmPayment(visitorId: string, id: string) {
    const viewing = await this.find(id);
    if (viewing.visitorId !== visitorId) throw new ForbiddenException();
    if (!viewing.stripePaymentIntentId)
      throw new ConflictException("Plata nu a fost initiata.");
    const intent = await this.stripePaymentsService.getPaymentIntent(
      viewing.stripePaymentIntentId,
    );
    if (intent.status !== "succeeded")
      throw new ConflictException("Plata nu este confirmata de Stripe.");
    await this.markPaid(intent.id);
    return this.find(id);
  }

  async markPaid(paymentIntentId: string) {
    await this.viewingModel
      .updateOne(
        { stripePaymentIntentId: paymentIntentId, status: "awaiting_payment" },
        { $set: { status: "confirmed", paidAt: new Date() } },
      )
      .exec();
  }

  private async find(id: string) {
    if (!Types.ObjectId.isValid(id))
      throw new NotFoundException("Vizionarea nu a fost gasita.");
    const viewing = await this.viewingModel.findById(id).exec();
    if (!viewing) throw new NotFoundException("Vizionarea nu a fost gasita.");
    return viewing;
  }
}
