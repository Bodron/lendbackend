import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { FilterQuery, Model, Types } from "mongoose";
import { User, UserDocument } from "../users/schemas/user.schema";
import { Product, ProductDocument } from "../products/schemas/product.schema";
import { RentalOrder, RentalOrderDocument } from "../rental-orders/schemas/rental-order.schema";
import { Viewing, ViewingDocument } from "../viewings/schemas/viewing.schema";

const PAGE_SIZE = 25;

@Injectable()
export class AdminService {
  constructor(
    @InjectModel(User.name) private readonly usersModel: Model<UserDocument>,
    @InjectModel(Product.name) private readonly productsModel: Model<ProductDocument>,
    @InjectModel(RentalOrder.name) private readonly ordersModel: Model<RentalOrderDocument>,
    @InjectModel(Viewing.name) private readonly viewingsModel: Model<ViewingDocument>,
  ) {}

  private page(value?: string) {
    const number = Number(value ?? 1);
    return Number.isSafeInteger(number) && number > 0 ? Math.min(number, 10000) : 1;
  }

  private search(q?: string) {
    const term = q?.trim().slice(0, 80);
    return term ? new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i") : null;
  }

  private async list(model: Model<any>, filter: FilterQuery<any>, page?: string) {
    const current = this.page(page);
    const [items, total] = await Promise.all([
      model.find(filter).sort({ createdAt: -1 }).skip((current - 1) * PAGE_SIZE).limit(PAGE_SIZE).lean().exec(),
      model.countDocuments(filter).exec(),
    ]);
    return { items, total, page: current, pageSize: PAGE_SIZE };
  }

  async users(page?: string, q?: string) {
    const search = this.search(q);
    const result = await this.list(this.usersModel, search ? { $or: [{ fullName: search }, { email: search }, { phone: search }] } : {}, page);
    return { ...result, items: result.items.map(({ passwordHash, identityVerificationSessionId, ...user }: Record<string, unknown>) => user) };
  }

  async deletions(page?: string) {
    const result = await this.list(this.usersModel, { deletionRequestedAt: { $exists: true } }, page);
    return { ...result, items: result.items.map(({ passwordHash, identityVerificationSessionId, ...user }: Record<string, unknown>) => user) };
  }

  products(page?: string, q?: string) {
    const search = this.search(q);
    return this.list(this.productsModel, search ? { $or: [{ title: search }, { ownerName: search }, { city: search }] } : {}, page);
  }

  async orders(page?: string) {
    const result = await this.list(this.ordersModel, {}, page);
    return { ...result, items: result.items.map(({ stripePaymentClientSecret, ...order }: Record<string, unknown>) => order) };
  }
  async sellers(page?: string) {
    const current = this.page(page);
    const [result] = await this.ordersModel.aggregate<{ items: Record<string, unknown>[]; count: { total: number }[] }>([
      { $match: { paymentStatus: { $in: ["captured", "succeeded"] }, refundStatus: { $ne: "succeeded" } } },
      { $lookup: { from: "products", localField: "productId", foreignField: "_id", as: "product" } },
      { $group: {
        _id: { ownerId: { $ifNull: [{ $arrayElemAt: ["$product.ownerId", 0] }, "$productSnapshot.ownerName"] }, ownerName: "$productSnapshot.ownerName" },
        sales: { $sum: 1 }, grossRon: { $sum: "$subtotal" },
        transferredRon: { $sum: { $cond: [{ $eq: ["$payoutStatus", "paid_out"] }, "$sellerNetAmount", 0] } },
      } },
      { $sort: { grossRon: -1 } },
      { $facet: { items: [{ $skip: (current - 1) * PAGE_SIZE }, { $limit: PAGE_SIZE }], count: [{ $count: "total" }] } },
    ]).exec();
    return { items: result?.items ?? [], total: result?.count[0]?.total ?? 0, page: current, pageSize: PAGE_SIZE };
  }
  viewings(page?: string) { return this.list(this.viewingsModel, {}, page); }

  async overview() {
    const [users, products, closedProducts, pendingDeletions, orders, viewings, rentalMoney, viewingMoney] = await Promise.all([
      this.usersModel.countDocuments(),
      this.productsModel.countDocuments(),
      this.productsModel.countDocuments({ isClosedByAdmin: true }),
      this.usersModel.countDocuments({ deletionRequestStatus: "pending" }),
      this.ordersModel.countDocuments(),
      this.viewingsModel.countDocuments(),
      this.ordersModel.aggregate([{ $group: {
        _id: null,
        capturedRon: { $sum: { $cond: [{ $in: ["$paymentStatus", ["captured", "succeeded"]] }, "$total", 0] } },
        platformFeeRon: { $sum: { $cond: [{ $in: ["$paymentStatus", ["captured", "succeeded"]] }, "$platformFee", 0] } },
        transferredRon: { $sum: { $cond: [{ $eq: ["$payoutStatus", "paid_out"] }, "$sellerNetAmount", 0] } },
      } }]),
      this.viewingsModel.aggregate([{ $group: {
        _id: null,
        capturedRon: { $sum: { $cond: [{ $ifNull: ["$paidAt", false] }, { $add: ["$priceRon", { $ifNull: ["$serviceFeeRon", 0] }] }, 0] } },
        transferredRon: { $sum: { $cond: [{ $ifNull: ["$stripeTransferId", false] }, "$priceRon", 0] } },
      } }]),
    ]);
    return { users, products, closedProducts, pendingDeletions, orders, viewings,
      rentalMoney: rentalMoney[0] ?? { capturedRon: 0, platformFeeRon: 0, transferredRon: 0 },
      viewingMoney: viewingMoney[0] ?? { capturedRon: 0, transferredRon: 0 },
    };
  }

  async moderateProduct(id: string, body: { closed?: unknown; reason?: unknown }, actorId: string) {
    if (!Types.ObjectId.isValid(id)) throw new NotFoundException("Anunțul nu există.");
    if (typeof body?.closed !== "boolean") throw new BadRequestException("closed trebuie să fie boolean.");
    const reason = typeof body.reason === "string" ? body.reason.trim().slice(0, 500) : "";
    if (body.closed && !reason) throw new BadRequestException("Motivul închiderii este obligatoriu.");
    const product = await this.productsModel.findByIdAndUpdate(id,
      body.closed
        ? { $set: { isClosedByAdmin: true, adminCloseReason: reason, adminClosedAt: new Date(), adminClosedBy: actorId } }
        : { $set: { isClosedByAdmin: false }, $unset: { adminCloseReason: 1, adminClosedAt: 1, adminClosedBy: 1 } },
      { new: true }).lean().exec();
    if (!product) throw new NotFoundException("Anunțul nu există.");
    return product;
  }
}
