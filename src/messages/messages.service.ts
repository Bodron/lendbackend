import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model, Types } from "mongoose";
import { Product, ProductDocument } from "../products/schemas/product.schema";
import { CreateMessageDto } from "./dto/create-message.dto";
import { Message, MessageDocument } from "./schemas/message.schema";

@Injectable()
export class MessagesService {
  constructor(
    @InjectModel(Message.name)
    private readonly messageModel: Model<MessageDocument>,
    @InjectModel(Product.name)
    private readonly productModel: Model<ProductDocument>,
  ) {}

  async findForProduct(userId: string, productId: string) {
    if (!Types.ObjectId.isValid(productId)) {
      throw new NotFoundException("Anuntul nu a fost gasit.");
    }

    const product = await this.productModel.findById(productId).select("ownerId ownerName title").exec();
    if (!product) {
      throw new NotFoundException("Anuntul nu a fost gasit.");
    }

    const messages = await this.messageModel
      .find({ productId: product._id, $or: [{ senderId: userId }, { recipientId: userId }] })
      .sort({ createdAt: 1 })
      .exec();

    await this.messageModel.updateMany(
      { productId: product._id, recipientId: userId, read: false },
      { $set: { read: true } },
    ).exec();

    return {
      productId,
      productTitle: product.title,
      ownerId: product.ownerId,
      ownerName: product.ownerName,
      messages,
    };
  }

  async findThreads(userId: string) {
    const productIds = await this.messageModel.distinct("productId", {
      $or: [{ senderId: userId }, { recipientId: userId }],
    });

    return Promise.all(
      productIds.map(async (productId: Types.ObjectId) => {
        const [latest, unread, product] = await Promise.all([
          this.messageModel.findOne({ productId }).sort({ createdAt: -1 }).exec(),
          this.messageModel.countDocuments({ productId, recipientId: userId, read: false }),
          this.productModel.findById(productId).select("title ownerName").exec(),
        ]);
        return {
          productId: productId.toString(),
          productTitle: product?.title ?? "Anunt",
          ownerName: product?.ownerName ?? "Proprietar",
          latestMessage: latest,
          unreadCount: unread,
        };
      }),
    );
  }

  async create(userId: string, dto: CreateMessageDto) {
    const product = await this.productModel.findById(dto.productId).exec();
    if (!product) {
      throw new NotFoundException("Anuntul nu a fost gasit.");
    }
    if (!product.ownerId) {
      throw new BadRequestException("Anuntul nu are un proprietar asociat.");
    }
    let recipientId = product.ownerId;
    if (product.ownerId === userId) {
      const previousMessage = await this.messageModel
        .findOne({
          productId: product._id,
          $or: [{ senderId: userId }, { recipientId: userId }],
        })
        .sort({ createdAt: -1 })
        .exec();

      recipientId = previousMessage
        ? previousMessage.senderId === userId
          ? previousMessage.recipientId
          : previousMessage.senderId
        : "";
    }

    if (!recipientId || recipientId === userId) {
      throw new BadRequestException("Nu există încă un utilizator în această conversație.");
    }

    return this.messageModel.create({
      productId: product._id,
      senderId: userId,
      recipientId,
      body: dto.body.trim(),
    });
  }
}
