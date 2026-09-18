import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { PushService } from "../push/push.service";
import { InjectModel } from "@nestjs/mongoose";
import { Model, Types } from "mongoose";
import { Product, ProductDocument } from "../products/schemas/product.schema";
import { S3StorageService } from "../storage/s3-storage.service";
import { User, UserDocument } from "../users/schemas/user.schema";
import { CreateMessageDto } from "./dto/create-message.dto";
import { Message, MessageDocument } from "./schemas/message.schema";
import { CreateRentalOfferDto } from "./dto/create-rental-offer.dto";
import {
  RentalOffer,
  RentalOfferDocument,
} from "./schemas/rental-offer.schema";

@Injectable()
export class MessagesService {
  constructor(
    private readonly pushService: PushService,
    @InjectModel(Message.name)
    private readonly messageModel: Model<MessageDocument>,
    @InjectModel(Product.name)
    private readonly productModel: Model<ProductDocument>,
    @InjectModel(User.name)
    private readonly userModel: Model<UserDocument>,
    private readonly s3StorageService: S3StorageService,
    @InjectModel(RentalOffer.name)
    private readonly offerModel: Model<RentalOfferDocument>,
  ) {}

  async findForProduct(
    userId: string,
    productId: string,
    roommateInterestId?: string,
  ) {
    if (!Types.ObjectId.isValid(productId)) {
      throw new NotFoundException("Anuntul nu a fost gasit.");
    }
    if (roommateInterestId && !Types.ObjectId.isValid(roommateInterestId)) {
      throw new NotFoundException("Conversatia nu a fost gasita.");
    }

    const product = await this.productModel
      .findById(productId)
      .select("ownerId ownerName title")
      .exec();
    if (!product) {
      throw new NotFoundException("Anuntul nu a fost gasit.");
    }

    const messages = await this.messageModel
      .find({
        productId: product._id,
        ...this.threadScope(roommateInterestId),
        $or: [{ senderId: userId }, { recipientId: userId }],
      })
      .sort({ createdAt: 1 })
      .exec();

    await this.messageModel
      .updateMany(
        {
          productId: product._id,
          recipientId: userId,
          read: false,
          ...this.threadScope(roommateInterestId),
        },
        { $set: { read: true } },
      )
      .exec();

    const latestMessage = messages[messages.length - 1];
    const otherUserId = latestMessage
      ? latestMessage.senderId === userId
        ? latestMessage.recipientId
        : latestMessage.senderId
      : product.ownerId;
    const participant = otherUserId
      ? await this.userModel
          .findById(otherUserId)
          .select("fullName avatarUrl avatarKey")
          .exec()
      : null;
    const participantAvatarUrl = participant?.avatarKey
      ? await this.s3StorageService.getReadableUrl(participant.avatarKey)
      : participant?.avatarUrl;

    return {
      productId,
      roommateInterestId: roommateInterestId ?? null,
      productTitle: product.title,
      ownerId: product.ownerId,
      ownerName: product.ownerName,
      participantName:
        participant?.fullName ?? product.ownerName ?? "Utilizator",
      participantAvatarUrl,
      offers: roommateInterestId
        ? []
        : await this.findOffers(userId, productId),
      messages,
    };
  }

  async findOffers(userId: string, productId: string) {
    return this.offerModel
      .find({ productId, $or: [{ senderId: userId }, { recipientId: userId }] })
      .sort({ createdAt: 1 })
      .exec();
  }

  async createOffer(userId: string, dto: CreateRentalOfferDto) {
    const product = await this.productModel.findById(dto.productId).exec();
    if (!product) throw new NotFoundException("Anuntul nu a fost gasit.");
    if (!product.ownerId)
      throw new BadRequestException("Anuntul nu are un proprietar asociat.");
    if (product.ownerId === userId)
      throw new BadRequestException(
        "Proprietarul nu poate trimite oferta pentru propriul anunt.",
      );
    if (new Date(dto.endDate) <= new Date(dto.startDate))
      throw new BadRequestException("Perioada ofertei nu este valida.");
    if (dto.rentalMode === "month" && !product.rentalModes.includes("month"))
      throw new BadRequestException("Anuntul nu permite inchiriere lunara.");
    return this.offerModel.create({
      productId: dto.productId,
      senderId: userId,
      recipientId: product.ownerId,
      amount: dto.amount,
      startDate: new Date(dto.startDate),
      endDate: new Date(dto.endDate),
      rentalMode: dto.rentalMode,
    });
  }

  async updateOffer(
    userId: string,
    offerId: string,
    status: "accepted" | "rejected",
  ) {
    if (!Types.ObjectId.isValid(offerId))
      throw new NotFoundException("Oferta nu a fost gasita.");
    const offer = await this.offerModel.findById(offerId).exec();
    if (!offer) throw new NotFoundException("Oferta nu a fost gasita.");
    if (offer.recipientId !== userId)
      throw new BadRequestException("Nu poti modifica aceasta oferta.");
    if (offer.status !== "pending")
      throw new BadRequestException("Oferta nu mai este activa.");
    offer.status = status;
    return offer.save();
  }

  async claimOffer(userId: string, offerId: string) {
    if (!Types.ObjectId.isValid(offerId))
      throw new NotFoundException("Oferta nu a fost gasita.");
    const offer = await this.offerModel
      .findOneAndUpdate(
        { _id: offerId, senderId: userId, status: "accepted" },
        { $set: { status: "checkout_started" } },
        { new: true },
      )
      .exec();
    if (!offer)
      throw new BadRequestException("Oferta nu mai poate fi folosita.");
    return offer;
  }

  async findThreads(userId: string) {
    const messages = await this.messageModel
      .find({ $or: [{ senderId: userId }, { recipientId: userId }] })
      .sort({ createdAt: -1 })
      .exec();
    const latestByThread = new Map<string, MessageDocument>();

    for (const message of messages) {
      const key = this.threadKey(
        message.productId.toString(),
        message.roommateInterestId?.toString(),
      );
      if (!latestByThread.has(key)) {
        latestByThread.set(key, message);
      }
    }

    return Promise.all(
      [...latestByThread.values()].map(async (latest) => {
        const productId = latest.productId;
        const roommateInterestId = latest.roommateInterestId?.toString();
        const scope = this.threadScope(roommateInterestId);
        const [unread, product] = await Promise.all([
          this.messageModel.countDocuments({
            productId,
            recipientId: userId,
            read: false,
            ...scope,
          }),
          this.productModel
            .findById(productId)
            .select("title ownerId ownerName")
            .exec(),
        ]);
        const otherUserId = latest
          ? latest.senderId === userId
            ? latest.recipientId
            : latest.senderId
          : product?.ownerId;
        const participant = otherUserId
          ? await this.userModel
              .findById(otherUserId)
              .select("fullName avatarUrl avatarKey")
              .exec()
          : null;
        const participantAvatarUrl = participant?.avatarKey
          ? await this.s3StorageService.getReadableUrl(participant.avatarKey)
          : participant?.avatarUrl;
        return {
          productId: productId.toString(),
          roommateInterestId: roommateInterestId ?? null,
          productTitle: product?.title ?? "Anunt",
          ownerName: product?.ownerName ?? "Proprietar",
          participantName:
            participant?.fullName ?? product?.ownerName ?? "Utilizator",
          participantAvatarUrl,
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
          ...this.threadScope(dto.roommateInterestId),
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
      throw new BadRequestException(
        "Nu există încă un utilizator în această conversație.",
      );
    }

    const message = await this.messageModel.create({
      productId: product._id,
      ...(dto.roommateInterestId
        ? { roommateInterestId: new Types.ObjectId(dto.roommateInterestId) }
        : {}),
      senderId: userId,
      recipientId,
      body: dto.body.trim(),
    });
    void this.pushService.sendMessage(
      recipientId,
      message._id.toString(),
      product._id.toString(),
      product.title,
    );
    return message;
  }

  async createDirect(
    senderId: string,
    recipientId: string,
    productId: string,
    body: string,
    roommateInterestId?: string,
  ) {
    if (!Types.ObjectId.isValid(productId)) {
      throw new NotFoundException("Anuntul nu a fost gasit.");
    }
    if (!recipientId || recipientId === senderId) {
      throw new BadRequestException("Destinatarul mesajului nu este valid.");
    }

    const product = await this.productModel.findById(productId).exec();
    if (!product) {
      throw new NotFoundException("Anuntul nu a fost gasit.");
    }

    const message = await this.messageModel.create({
      productId: product._id,
      ...(roommateInterestId
        ? { roommateInterestId: new Types.ObjectId(roommateInterestId) }
        : {}),
      senderId,
      recipientId,
      body: body.trim(),
    });
    void this.pushService.sendMessage(
      recipientId,
      message._id.toString(),
      product._id.toString(),
      product.title,
    );
    return message;
  }

  private threadScope(roommateInterestId?: string) {
    return roommateInterestId
      ? { roommateInterestId: new Types.ObjectId(roommateInterestId) }
      : { roommateInterestId: { $exists: false } };
  }

  private threadKey(productId: string, roommateInterestId?: string) {
    return `${productId}:${roommateInterestId ?? ""}`;
  }
}
