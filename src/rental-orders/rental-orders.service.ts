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
import { CreateRentalOrderDto } from "./dto/create-rental-order.dto";
import {
  RentalOrder,
  RentalOrderDocument,
  RentalOrderStatus,
} from "./schemas/rental-order.schema";

const blockingStatuses = [
  RentalOrderStatus.Pending,
  RentalOrderStatus.Confirmed,
  RentalOrderStatus.Active,
];

@Injectable()
export class RentalOrdersService {
  constructor(
    @InjectModel(RentalOrder.name)
    private readonly rentalOrderModel: Model<RentalOrderDocument>,
    @InjectModel(Product.name)
    private readonly productModel: Model<ProductDocument>,
    private readonly s3StorageService: S3StorageService,
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

    if (overlappingOrder) {
      throw new ConflictException(
        "Produsul este deja rezervat in perioada aleasa.",
      );
    }

    const subtotal = range.rentalDays * product.pricePerDay;
    const serviceFee = Math.round(subtotal * 0.05);
    const image = product.images[0];

    return this.rentalOrderModel.create({
      productId: product._id,
      renterId,
      productSnapshot: {
        title: product.title,
        slug: product.slug,
        category: product.category,
        categorySlug: product.categorySlug,
        city: product.city,
        ownerName: product.ownerName,
        imageUrl: image?.key
          ? await this.s3StorageService.getReadableUrl(image.key)
          : image?.url,
      },
      startDate: range.startDate,
      endDate: range.endDate,
      rentalDays: range.rentalDays,
      pricePerDay: product.pricePerDay,
      subtotal,
      serviceFee,
      deposit: product.deposit,
      total: subtotal + serviceFee + product.deposit,
      status: RentalOrderStatus.Pending,
    });
  }

  async findMine(renterId: string): Promise<RentalOrderDocument[]> {
    return this.rentalOrderModel
      .find({ renterId })
      .sort({ createdAt: -1 })
      .exec();
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

  async getAvailability(productId: string, from: string, to: string) {
    if (!Types.ObjectId.isValid(productId)) {
      throw new NotFoundException("Produsul nu a fost gasit.");
    }

    const product = await this.productModel.findById(productId).exec();

    if (!product) {
      throw new NotFoundException("Produsul nu a fost gasit.");
    }

    const range = this.parseDateRange(from, to, { allowPast: true });
    const orders = await this.rentalOrderModel
      .find({
        productId: product._id,
        status: { $in: blockingStatuses },
        startDate: { $lt: range.endDate },
        endDate: { $gt: range.startDate },
      })
      .sort({ startDate: 1 })
      .exec();

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

    return {
      productId,
      from: this.toDateKey(range.startDate),
      to: this.toDateKey(range.endDate),
      isAvailable: orders.length === 0,
      unavailableDates: [...unavailableDates].sort(),
      reservations: orders.map((order) => ({
        id: order._id.toString(),
        startDate: this.toDateKey(order.startDate),
        endDate: this.toDateKey(order.endDate),
        status: order.status,
      })),
    };
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

    if (endDate <= startDate) {
      throw new BadRequestException(
        "Data de final trebuie sa fie dupa inceput.",
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
