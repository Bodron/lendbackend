import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model, Types } from "mongoose";
import { Product, ProductDocument } from "../products/schemas/product.schema";
import { S3StorageService } from "../storage/s3-storage.service";
import { UsersService } from "../users/users.service";
import { StripePaymentsService } from "../payments/stripe-payments.service";
import { CreateAvailabilityBlockDto } from "./dto/create-availability-block.dto";
import { CreateRentalOrderDto } from "./dto/create-rental-order.dto";
import { UpdateRentalScheduleDto } from "./dto/update-rental-schedule.dto";
import {
  AvailabilityBlock,
  AvailabilityBlockDocument,
} from "./schemas/availability-block.schema";
import {
  RentalOrder,
  RentalOrderDocument,
  RentalPaymentStatus,
  RentalPayoutStatus,
  RentalOrderStatus,
} from "./schemas/rental-order.schema";

const blockingStatuses = [
  RentalOrderStatus.Confirmed,
  RentalOrderStatus.Active,
];

@Injectable()
export class RentalOrdersService {
  constructor(
    @InjectModel(RentalOrder.name)
    private readonly rentalOrderModel: Model<RentalOrderDocument>,
    @InjectModel(AvailabilityBlock.name)
    private readonly availabilityBlockModel: Model<AvailabilityBlockDocument>,
    @InjectModel(Product.name)
    private readonly productModel: Model<ProductDocument>,
    private readonly s3StorageService: S3StorageService,
    private readonly usersService: UsersService,
    private readonly stripePaymentsService: StripePaymentsService,
  ) {}

  async create(
    renterId: string,
    dto: CreateRentalOrderDto,
  ): Promise<RentalOrderDocument> {
    const product = await this.productModel.findById(dto.productId).exec();

    if (!product) {
      throw new NotFoundException("Produsul nu a fost gasit.");
    }

    if (!product.isAvailable) {
      throw new ConflictException(
        "Produsul nu este disponibil pentru inchiriere.",
      );
    }

    const range = this.parseDateRange(dto.startDate, dto.endDate);
    const overlappingOrder = await this.findOverlappingOrder(
      product._id,
      range.startDate,
      range.endDate,
    );
    const overlappingBlock = await this.findOverlappingBlock(
      product._id,
      range.startDate,
      range.endDate,
    );

    if (overlappingOrder || overlappingBlock) {
      throw new ConflictException(
        "Produsul nu este disponibil in perioada aleasa.",
      );
    }

    const pickupTime = dto.pickupTime ?? product.pickupTime ?? "10:00";
    const returnTime = dto.returnTime ?? product.returnTime ?? "18:00";
    const rentalMode = dto.rentalMode ?? "day";
    const hourlyPrice = Math.max(1, Math.round(product.pricePerDay / 8));
    const rentalHours =
      rentalMode === "hour"
        ? this.calculateRentalHours(
            range.startDate,
            range.endDate,
            pickupTime,
            returnTime,
          )
        : range.rentalDays * 24;
    const subtotal =
      rentalMode === "hour"
        ? rentalHours * hourlyPrice
        : range.rentalDays * product.pricePerDay;
    const serviceFee = Math.round(subtotal * 0.05);
    const image = product.images[0];

    const platformFee = serviceFee;
    const ownerEarnings = subtotal;
    const order = await this.rentalOrderModel.create({
      productId: product._id,
      renterId,
      productSnapshot: {
        title: product.title,
        slug: product.slug,
        category: product.category,
        categorySlug: product.categorySlug,
        city: product.city,
        ownerName: product.ownerName,
        imageKey: image?.key,
        imageUrl: image?.key
          ? await this.s3StorageService.getReadableUrl(image.key)
          : image?.url,
        imageContentType: image?.contentType,
        imageType: image?.type,
      },
      startDate: range.startDate,
      endDate: range.endDate,
      pickupTime,
      returnTime,
      rentalMode,
      rentalHours,
      rentalDays: range.rentalDays,
      pricePerDay: rentalMode === "hour" ? hourlyPrice : product.pricePerDay,
      subtotal,
      serviceFee,
      platformFee,
      ownerEarnings,
      deposit: product.deposit,
      total: subtotal + serviceFee + product.deposit,
      paymentStatus: RentalPaymentStatus.RequiresPayment,
      payoutStatus: RentalPayoutStatus.NotReady,
      status: RentalOrderStatus.Pending,
    });

    const paymentIntent =
      await this.stripePaymentsService.createManualCapturePaymentIntent({
        amountRon: order.total,
        orderId: order._id.toString(),
        renterId,
        productId: product._id.toString(),
      });

    order.stripePaymentIntentId = paymentIntent.id;
    order.stripePaymentClientSecret = paymentIntent.client_secret ?? undefined;

    return order.save();
  }

  async findMine(renterId: string): Promise<RentalOrderDocument[]> {
    const orders = await this.rentalOrderModel
      .find({ renterId })
      .sort({ createdAt: -1 })
      .exec();

    await Promise.all(orders.map((order) => this.hydrateOrderMedia(order)));

    return orders;
  }

  async findOwned(ownerId: string, ownerName: string) {
    const products = await this.productModel
      .find({ $or: [{ ownerId }, { ownerName }] })
      .select("_id")
      .exec();
    const productIds = products.map((product) => product._id);

    if (productIds.length === 0) {
      return [];
    }

    const orders = await this.rentalOrderModel
      .find({ productId: { $in: productIds } })
      .sort({ createdAt: -1 })
      .exec();

    await Promise.all(orders.map((order) => this.hydrateOrderMedia(order)));

    return Promise.all(
      orders.map(async (order) => {
        const renter = await this.usersService.findById(order.renterId);

        return {
          ...order.toObject(),
          renter: renter
            ? {
                id: renter.id,
                fullName: renter.fullName,
                email: renter.email,
                phone: renter.phone,
              }
            : undefined,
        };
      }),
    );
  }

  async updateStatus(
    orderId: string,
    status: RentalOrderStatus,
  ): Promise<RentalOrderDocument> {
    if (!Types.ObjectId.isValid(orderId)) {
      throw new NotFoundException("Comanda nu a fost gasita.");
    }

    const order = await this.rentalOrderModel.findById(orderId).exec();

    if (!order) {
      throw new NotFoundException("Comanda nu a fost gasita.");
    }

    if (blockingStatuses.includes(status)) {
      const overlappingOrder = await this.findOverlappingOrder(
        order.productId,
        order.startDate,
        order.endDate,
        order._id,
      );

      if (overlappingOrder) {
        throw new ConflictException(
          "Exista deja o rezervare activa pe aceasta perioada.",
        );
      }
    }

    order.status = status;
    return order.save();
  }

  async markPaymentAuthorized(
    renterId: string,
    orderId: string,
  ): Promise<RentalOrderDocument> {
    const order = await this.findOrderOrFail(orderId);

    if (order.renterId !== renterId) {
      throw new NotFoundException("Comanda nu a fost gasita.");
    }

    if (!order.stripePaymentIntentId) {
      throw new BadRequestException("Comanda nu are plata Stripe.");
    }

    const paymentIntent = await this.stripePaymentsService.getPaymentIntent(
      order.stripePaymentIntentId,
    );

    if (paymentIntent.status !== "requires_capture") {
      throw new BadRequestException("Plata nu este autorizata in Stripe.");
    }

    order.paymentStatus = RentalPaymentStatus.Authorized;
    return order.save();
  }

  async acceptOrder(
    ownerId: string,
    ownerName: string,
    orderId: string,
  ): Promise<RentalOrderDocument> {
    const order = await this.findOrderOrFail(orderId);
    await this.assertOwnerCanManageOrder(ownerId, ownerName, order);

    if (order.status !== RentalOrderStatus.Pending) {
      throw new BadRequestException("Cererea nu mai poate fi acceptata.");
    }

    if (order.paymentStatus !== RentalPaymentStatus.Authorized) {
      throw new BadRequestException("Cererea nu are plata autorizata inca.");
    }

    const overlappingOrder = await this.findOverlappingOrder(
      order.productId,
      order.startDate,
      order.endDate,
      order._id,
    );

    if (overlappingOrder) {
      throw new ConflictException(
        "Exista deja o rezervare activa pe aceasta perioada.",
      );
    }

    if (!order.stripePaymentIntentId) {
      throw new BadRequestException("Comanda nu are plata Stripe.");
    }

    await this.stripePaymentsService.capturePaymentIntent(
      order.stripePaymentIntentId,
    );

    order.status = RentalOrderStatus.Confirmed;
    order.paymentStatus = RentalPaymentStatus.Captured;
    order.payoutStatus = RentalPayoutStatus.PendingOnboarding;

    return order.save();
  }

  async rejectOrder(
    ownerId: string,
    ownerName: string,
    orderId: string,
  ): Promise<RentalOrderDocument> {
    const order = await this.findOrderOrFail(orderId);
    await this.assertOwnerCanManageOrder(ownerId, ownerName, order);

    if (order.status !== RentalOrderStatus.Pending) {
      throw new BadRequestException("Cererea nu mai poate fi refuzata.");
    }

    if (order.stripePaymentIntentId) {
      await this.stripePaymentsService.cancelPaymentIntent(
        order.stripePaymentIntentId,
      );
    }

    order.status = RentalOrderStatus.Rejected;
    order.paymentStatus = RentalPaymentStatus.Cancelled;
    order.payoutStatus = RentalPayoutStatus.NotReady;

    return order.save();
  }

  async updateSchedule(
    ownerId: string,
    ownerName: string,
    orderId: string,
    dto: UpdateRentalScheduleDto,
  ): Promise<RentalOrderDocument> {
    if (!Types.ObjectId.isValid(orderId)) {
      throw new NotFoundException("Comanda nu a fost gasita.");
    }

    const order = await this.rentalOrderModel.findById(orderId).exec();

    if (!order) {
      throw new NotFoundException("Comanda nu a fost gasita.");
    }

    if (
      order.status === RentalOrderStatus.Completed ||
      order.status === RentalOrderStatus.Cancelled ||
      order.status === RentalOrderStatus.Rejected
    ) {
      throw new BadRequestException(
        "Programul nu mai poate fi modificat pentru aceasta comanda.",
      );
    }

    const product = await this.productModel.findById(order.productId).exec();

    if (
      !product ||
      (product.ownerId !== ownerId && product.ownerName !== ownerName)
    ) {
      throw new NotFoundException("Comanda nu a fost gasita.");
    }

    order.pickupTime = dto.pickupTime;
    order.returnTime = dto.returnTime;

    return order.save();
  }

  async getAvailability(productId: string, from: string, to: string) {
    const product = await this.findProductOrFail(productId);

    const range = this.parseDateRange(from, to, { allowPast: true });
    const [orders, blocks] = await Promise.all([
      this.rentalOrderModel
        .find({
          productId: product._id,
          status: { $in: blockingStatuses },
          startDate: { $lt: range.endDate },
          endDate: { $gt: range.startDate },
        })
        .sort({ startDate: 1 })
        .exec(),
      this.availabilityBlockModel
        .find({
          productId: product._id,
          startDate: { $lt: range.endDate },
          endDate: { $gt: range.startDate },
        })
        .sort({ startDate: 1 })
        .exec(),
    ]);

    const unavailableDates = new Set<string>();

    for (const order of orders) {
      const unavailableStart =
        order.startDate > range.startDate ? order.startDate : range.startDate;
      const unavailableEnd =
        order.endDate < range.endDate ? order.endDate : range.endDate;

      for (const date of this.eachDate(unavailableStart, unavailableEnd)) {
        unavailableDates.add(this.toDateKey(date));
      }
    }

    for (const block of blocks) {
      const unavailableStart =
        block.startDate > range.startDate ? block.startDate : range.startDate;
      const unavailableEnd =
        block.endDate < range.endDate ? block.endDate : range.endDate;

      for (const date of this.eachDate(unavailableStart, unavailableEnd)) {
        unavailableDates.add(this.toDateKey(date));
      }
    }

    return {
      productId,
      from: this.toDateKey(range.startDate),
      to: this.toDateKey(range.endDate),
      isAvailable: orders.length === 0 && blocks.length === 0,
      unavailableDates: [...unavailableDates].sort(),
      reservations: orders.map((order) => ({
        id: order._id.toString(),
        startDate: this.toDateKey(order.startDate),
        endDate: this.toDateKey(order.endDate),
        status: order.status,
      })),
      manualBlocks: blocks.map((block) => ({
        id: block._id.toString(),
        startDate: this.toDateKey(block.startDate),
        endDate: this.toDateKey(block.endDate),
        reason: block.reason ?? "",
      })),
    };
  }

  async createAvailabilityBlock(
    ownerId: string,
    ownerName: string,
    productId: string,
    dto: CreateAvailabilityBlockDto,
  ): Promise<AvailabilityBlockDocument> {
    const product = await this.findProductOrFail(productId);

    if (product.ownerId !== ownerId && product.ownerName !== ownerName) {
      throw new NotFoundException("Produsul nu a fost gasit.");
    }

    const range = this.parseDateRange(dto.startDate, dto.endDate);
    const [overlappingOrder, overlappingBlock] = await Promise.all([
      this.findOverlappingOrder(product._id, range.startDate, range.endDate),
      this.findOverlappingBlock(product._id, range.startDate, range.endDate),
    ]);

    if (overlappingOrder) {
      throw new ConflictException(
        "Exista deja o inchiriere in perioada aleasa.",
      );
    }

    if (overlappingBlock) {
      throw new ConflictException(
        "Exista deja un blocaj manual in perioada aleasa.",
      );
    }

    return this.availabilityBlockModel.create({
      productId: product._id,
      ownerId,
      startDate: range.startDate,
      endDate: range.endDate,
      reason: dto.reason?.trim(),
    });
  }

  async deleteAvailabilityBlock(ownerId: string, blockId: string) {
    if (!Types.ObjectId.isValid(blockId)) {
      throw new NotFoundException("Blocajul nu a fost gasit.");
    }

    const block = await this.availabilityBlockModel
      .findOneAndDelete({ _id: blockId, ownerId })
      .exec();

    if (!block) {
      throw new NotFoundException("Blocajul nu a fost gasit.");
    }

    return { deleted: true, id: block._id.toString() };
  }

  private async findOverlappingOrder(
    productId: Types.ObjectId,
    startDate: Date,
    endDate: Date,
    excludeOrderId?: Types.ObjectId,
  ): Promise<RentalOrderDocument | null> {
    return this.rentalOrderModel
      .findOne({
        ...(excludeOrderId ? { _id: { $ne: excludeOrderId } } : {}),
        productId,
        status: { $in: blockingStatuses },
        startDate: { $lt: endDate },
        endDate: { $gt: startDate },
      })
      .exec();
  }

  private async findOrderOrFail(orderId: string): Promise<RentalOrderDocument> {
    if (!Types.ObjectId.isValid(orderId)) {
      throw new NotFoundException("Comanda nu a fost gasita.");
    }

    const order = await this.rentalOrderModel.findById(orderId).exec();

    if (!order) {
      throw new NotFoundException("Comanda nu a fost gasita.");
    }

    return order;
  }

  private async assertOwnerCanManageOrder(
    ownerId: string,
    ownerName: string,
    order: RentalOrderDocument,
  ): Promise<void> {
    const product = await this.productModel.findById(order.productId).exec();

    if (
      !product ||
      (product.ownerId !== ownerId && product.ownerName !== ownerName)
    ) {
      throw new NotFoundException("Comanda nu a fost gasita.");
    }
  }

  private async findOverlappingBlock(
    productId: Types.ObjectId,
    startDate: Date,
    endDate: Date,
    excludeBlockId?: Types.ObjectId,
  ): Promise<AvailabilityBlockDocument | null> {
    return this.availabilityBlockModel
      .findOne({
        ...(excludeBlockId ? { _id: { $ne: excludeBlockId } } : {}),
        productId,
        startDate: { $lt: endDate },
        endDate: { $gt: startDate },
      })
      .exec();
  }

  private async findProductOrFail(productId: string): Promise<ProductDocument> {
    if (!Types.ObjectId.isValid(productId)) {
      throw new NotFoundException("Produsul nu a fost gasit.");
    }

    const product = await this.productModel.findById(productId).exec();

    if (!product) {
      throw new NotFoundException("Produsul nu a fost gasit.");
    }

    return product;
  }

  private async hydrateOrderMedia(order: RentalOrderDocument): Promise<void> {
    let imageKey = order.productSnapshot.imageKey;
    let product: ProductDocument | null = null;

    if (!imageKey) {
      product = await this.productModel.findById(order.productId).exec();
      imageKey = product?.images[0]?.key;
    }

    if (imageKey) {
      order.productSnapshot.imageUrl =
        await this.s3StorageService.getReadableUrl(imageKey);
    }

    if (
      !order.productSnapshot.imageContentType ||
      !order.productSnapshot.imageType
    ) {
      product ??= await this.productModel.findById(order.productId).exec();
      const image = product?.images.find((media) => media.key === imageKey);

      order.productSnapshot.imageContentType = image?.contentType;
      order.productSnapshot.imageType = image?.type;
    }
  }

  private parseDateRange(
    startDateInput: string,
    endDateInput: string,
    options: { allowPast?: boolean } = {},
  ) {
    const startDate = this.toUtcDate(startDateInput);
    const endDate = this.toUtcDate(endDateInput);
    const today = this.toUtcDate(new Date().toISOString());

    if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
      throw new BadRequestException("Perioada aleasa este invalida.");
    }

    if (!options.allowPast && startDate < today) {
      throw new BadRequestException("Data de inceput nu poate fi in trecut.");
    }

    if (endDate < startDate) {
      throw new BadRequestException(
        "Data de final nu poate fi inainte de inceput.",
      );
    }

    const rentalDays = Math.max(
      1,
      Math.round(
        (endDate.getTime() - startDate.getTime()) / (24 * 60 * 60 * 1000),
      ),
    );

    return { startDate, endDate, rentalDays };
  }

  private calculateRentalHours(
    startDate: Date,
    endDate: Date,
    pickupTime: string,
    returnTime: string,
  ): number {
    const start = this.withTime(startDate, pickupTime);
    const end = this.withTime(endDate, returnTime);

    if (end <= start) {
      throw new BadRequestException(
        "Ora de retur trebuie sa fie dupa ora de ridicare.",
      );
    }

    return Math.max(
      1,
      Math.ceil((end.getTime() - start.getTime()) / (60 * 60 * 1000)),
    );
  }

  private withTime(date: Date, time: string): Date {
    const [hours, minutes] = time.split(":").map(Number);

    return new Date(
      Date.UTC(
        date.getUTCFullYear(),
        date.getUTCMonth(),
        date.getUTCDate(),
        hours,
        minutes,
      ),
    );
  }

  private toUtcDate(value: string): Date {
    const date = new Date(value);
    return new Date(
      Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
    );
  }

  private *eachDate(startDate: Date, endDate: Date): Generator<Date> {
    for (
      let current = new Date(startDate);
      current < endDate;
      current = new Date(current.getTime() + 24 * 60 * 60 * 1000)
    ) {
      yield current;
    }
  }

  private toDateKey(date: Date): string {
    return date.toISOString().slice(0, 10);
  }
}
