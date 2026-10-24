import { Injectable, NotFoundException } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model, Types } from "mongoose";
import { Product, ProductDocument } from "../products/schemas/product.schema";
import { Favorite, FavoriteDocument } from "./schemas/favorite.schema";

@Injectable()
export class FavoritesService {
  constructor(
    @InjectModel(Favorite.name) private readonly favorites: Model<FavoriteDocument>,
    @InjectModel(Product.name) private readonly products: Model<ProductDocument>,
  ) {}

  async list(userId: string) {
    const rows = await this.favorites.find({ userId }).sort({ createdAt: -1 }).exec();
    return { productIds: rows.map((row) => row.productId.toString()) };
  }

  async add(userId: string, productId: string) {
    const id = this.parseId(productId);
    const exists = await this.products.exists({ _id: id, isClosedByAdmin: { $ne: true } });
    if (!exists) throw new NotFoundException("Anuntul nu a fost gasit.");
    await this.favorites.updateOne(
      { userId, productId: id },
      { $setOnInsert: { userId, productId: id } },
      { upsert: true },
    ).exec();
    return { productId, saved: true };
  }

  async remove(userId: string, productId: string) {
    const id = this.parseId(productId);
    await this.favorites.deleteOne({ userId, productId: id }).exec();
    return { productId, saved: false };
  }

  async import(userId: string, productIds: string[]) {
    const ids = [...new Set(productIds)].map((id) => new Types.ObjectId(id));
    if (ids.length > 0) {
      const existing = await this.products.find({
        _id: { $in: ids },
        isClosedByAdmin: { $ne: true },
      }).select("_id").exec();
      if (existing.length > 0) {
        await this.favorites.bulkWrite(existing.map((product) => ({
          updateOne: {
            filter: { userId, productId: product._id },
            update: { $setOnInsert: { userId, productId: product._id } },
            upsert: true,
          },
        })), { ordered: false });
      }
    }
    return this.list(userId);
  }

  private parseId(productId: string) {
    if (!Types.ObjectId.isValid(productId)) {
      throw new NotFoundException("Anuntul nu a fost gasit.");
    }
    return new Types.ObjectId(productId);
  }
}
