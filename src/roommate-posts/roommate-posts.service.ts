import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { FilterQuery, Model, Types } from "mongoose";
import { Product, ProductDocument } from "../products/schemas/product.schema";
import { S3StorageService } from "../storage/s3-storage.service";
import { type SafeUser, UsersService } from "../users/users.service";
import { CreateRoommateInterestDto } from "./dto/create-roommate-interest.dto";
import { CreateRoommatePostDto } from "./dto/create-roommate-post.dto";
import {
  RoommateInterest,
  RoommateInterestDocument,
} from "./schemas/roommate-interest.schema";
import {
  RoommatePost,
  RoommatePostDocument,
  RoommatePostStatus,
} from "./schemas/roommate-post.schema";

@Injectable()
export class RoommatePostsService {
  constructor(
    @InjectModel(RoommatePost.name)
    private readonly postModel: Model<RoommatePostDocument>,
    @InjectModel(RoommateInterest.name)
    private readonly interestModel: Model<RoommateInterestDocument>,
    @InjectModel(Product.name)
    private readonly productModel: Model<ProductDocument>,
    private readonly usersService: UsersService,
    private readonly s3StorageService: S3StorageService,
  ) {}

  async findAll(filters: RoommatePostFilters = {}) {
    const query: FilterQuery<RoommatePostDocument> = {
      status: RoommatePostStatus.Open,
    };
    const text = filters.q?.trim();
    const minBudget = this.toOptionalNumber(filters.minBudget);
    const maxBudget = this.toOptionalNumber(filters.maxBudget);
    const latitude = this.toOptionalNumber(filters.lat);
    const longitude = this.toOptionalNumber(filters.lng);
    const radiusKm = this.toOptionalNumber(filters.radiusKm);

    if (text) {
      const pattern = this.regexFor(text);
      const textQuery = [
        { city: pattern },
        { area: pattern },
        { title: pattern },
        { description: pattern },
        { preferences: pattern },
      ];
      query.$and = query.$and ?? [];
      query.$and.push({ $or: textQuery });
    }

    if (minBudget !== undefined || maxBudget !== undefined) {
      query.budgetPerMonth = {};
      if (minBudget !== undefined) query.budgetPerMonth.$gte = minBudget;
      if (maxBudget !== undefined) query.budgetPerMonth.$lte = maxBudget;
    }

    if (
      latitude !== undefined &&
      longitude !== undefined &&
      radiusKm !== undefined &&
      radiusKm > 0
    ) {
      const productIds = await this.findProductIdsNear(
        latitude,
        longitude,
        radiusKm,
      );
      query.productId = { $in: productIds };
    }

    const posts = await this.postModel
      .find(query)
      .sort({ createdAt: -1 })
      .exec();

    return Promise.all(posts.map((post) => this.withProduct(post)));
  }

  async findMine(userId: string) {
    const [posts, interests] = await Promise.all([
      this.postModel.find({ authorId: userId }).sort({ createdAt: -1 }).exec(),
      this.interestModel
        .find({ senderId: userId })
        .sort({ createdAt: -1 })
        .exec(),
    ]);

    return {
      posts: await Promise.all(posts.map((post) => this.withProduct(post))),
      interests,
    };
  }

  async create(author: SafeUser, dto: CreateRoommatePostDto) {
    let product: ProductDocument | null = null;

    if (dto.productId) {
      if (!Types.ObjectId.isValid(dto.productId)) {
        throw new NotFoundException("Apartamentul nu a fost gasit.");
      }

      product = await this.productModel.findById(dto.productId).exec();

      if (!product) {
        throw new NotFoundException("Apartamentul nu a fost gasit.");
      }

      if (product.categorySlug !== "imobiliare") {
        throw new BadRequestException(
          "Poti cauta coleg doar pentru anunturi imobiliare.",
        );
      }
    }

    const post = await this.postModel.create({
      productId: product?._id,
      authorId: author.id,
      authorName: author.fullName,
      authorAvatarUrl: author.avatarUrl,
      title: dto.title,
      city: dto.city,
      area: dto.area ?? "",
      budgetPerMonth: dto.budgetPerMonth,
      moveInDate: dto.moveInDate ?? "",
      description: dto.description,
      preferences: dto.preferences ?? [],
      status: RoommatePostStatus.Open,
    });

    return this.withProduct(post);
  }

  async createInterest(
    sender: SafeUser,
    postId: string,
    dto: CreateRoommateInterestDto,
  ) {
    if (!Types.ObjectId.isValid(postId)) {
      throw new NotFoundException("Anuntul de coleg nu a fost gasit.");
    }

    const post = await this.postModel.findById(postId).exec();

    if (!post || post.status !== RoommatePostStatus.Open) {
      throw new NotFoundException("Anuntul de coleg nu a fost gasit.");
    }

    if (post.authorId === sender.id) {
      throw new BadRequestException(
        "Nu poti trimite cerere la propriul anunt.",
      );
    }

    try {
      return await this.interestModel.create({
        postId: post._id,
        senderId: sender.id,
        senderName: sender.fullName,
        senderAvatarUrl: sender.avatarUrl,
        recipientId: post.authorId,
        message: dto.message?.trim() ?? "",
      });
    } catch (error) {
      if ((error as { code?: number }).code === 11000) {
        throw new BadRequestException("Ai trimis deja o cerere pentru anunt.");
      }

      throw error;
    }
  }

  async close(userId: string, postId: string) {
    if (!Types.ObjectId.isValid(postId)) {
      throw new NotFoundException("Anuntul de coleg nu a fost gasit.");
    }

    const post = await this.postModel.findById(postId).exec();

    if (!post) {
      throw new NotFoundException("Anuntul de coleg nu a fost gasit.");
    }

    if (post.authorId !== userId) {
      throw new ForbiddenException("Nu poti inchide acest anunt.");
    }

    post.status = RoommatePostStatus.Closed;
    return this.withProduct(await post.save());
  }

  private async withProduct(post: RoommatePostDocument) {
    const postObject = post.toObject();
    const product = post.productId
      ? await this.productModel.findById(post.productId).exec()
      : null;
    const author = await this.usersService.findById(post.authorId);
    const authorAvatarUrl = author?.avatarKey
      ? await this.s3StorageService.getReadableUrl(author.avatarKey)
      : (author?.avatarUrl ?? post.authorAvatarUrl);
    const productImage = product?.images[0];

    return {
      ...postObject,
      authorAvatarUrl,
      product: product
        ? {
            id: product._id.toString(),
            title: product.title,
            city: product.city,
            address: product.address,
            pricePerMonth: product.pricePerMonth,
            pricePerDay: product.pricePerDay,
            imageUrl: productImage
              ? await this.s3StorageService.getReadableUrl(productImage.key)
              : "",
          }
        : null,
    };
  }

  private toOptionalNumber(value?: string) {
    if (!value) return undefined;
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : undefined;
  }

  private regexFor(value: string) {
    return new RegExp(this.escapeRegex(value), "i");
  }

  private escapeRegex(value: string) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  private async findProductIdsNear(
    latitude: number,
    longitude: number,
    radiusKm: number,
  ) {
    const latitudeDelta = radiusKm / 111;
    const longitudeDelta =
      radiusKm / (111 * Math.max(Math.cos((latitude * Math.PI) / 180), 0.1));
    const products = await this.productModel
      .find({
        categorySlug: "imobiliare",
        latitude: {
          $gte: latitude - latitudeDelta,
          $lte: latitude + latitudeDelta,
        },
        longitude: {
          $gte: longitude - longitudeDelta,
          $lte: longitude + longitudeDelta,
        },
      })
      .select("_id latitude longitude")
      .lean()
      .exec();

    return products
      .filter(
        (product) =>
          typeof product.latitude === "number" &&
          typeof product.longitude === "number" &&
          this.distanceKm(
            latitude,
            longitude,
            product.latitude,
            product.longitude,
          ) <= radiusKm,
      )
      .map((product) => product._id);
  }

  private distanceKm(
    fromLatitude: number,
    fromLongitude: number,
    toLatitude: number,
    toLongitude: number,
  ) {
    const earthRadiusKm = 6371;
    const deltaLatitude = this.toRadians(toLatitude - fromLatitude);
    const deltaLongitude = this.toRadians(toLongitude - fromLongitude);
    const startLatitude = this.toRadians(fromLatitude);
    const endLatitude = this.toRadians(toLatitude);
    const haversine =
      Math.sin(deltaLatitude / 2) * Math.sin(deltaLatitude / 2) +
      Math.cos(startLatitude) *
        Math.cos(endLatitude) *
        Math.sin(deltaLongitude / 2) *
        Math.sin(deltaLongitude / 2);

    return (
      earthRadiusKm *
      2 *
      Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine))
    );
  }

  private toRadians(value: number) {
    return (value * Math.PI) / 180;
  }
}

type RoommatePostFilters = {
  minBudget?: string;
  maxBudget?: string;
  lat?: string;
  lng?: string;
  radiusKm?: string;
  q?: string;
};
