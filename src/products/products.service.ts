import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model, Types } from "mongoose";
import { CategoriesService } from "../categories/categories.service";
import { S3StorageService } from "../storage/s3-storage.service";
import { type SafeUser } from "../users/users.service";
import { CreateProductDto } from "./dto/create-product.dto";
import { UpdateProductDto } from "./dto/update-product.dto";
import { mockProducts } from "./mock-products";
import {
  Product,
  ProductDocument,
  type ProductImage,
} from "./schemas/product.schema";

type ProductResponse = Record<string, unknown> & {
  images: ProductImage[];
};

@Injectable()
export class ProductsService {
  constructor(
    @InjectModel(Product.name)
    private readonly productModel: Model<ProductDocument>,
    private readonly s3StorageService: S3StorageService,
    private readonly categoriesService: CategoriesService,
  ) {}

  async findAll(): Promise<ProductResponse[]> {
    const products = await this.productModel
      .find()
      .sort({ createdAt: -1 })
      .exec();
    return Promise.all(
      products.map((product) => this.withReadableImageUrls(product)),
    );
  }

  async findMine(userId: string, ownerName: string): Promise<ProductResponse[]> {
    const products = await this.productModel
      .find({
        $or: [{ ownerId: userId }, { ownerName }],
      })
      .sort({ createdAt: -1 })
      .exec();

    return Promise.all(
      products.map((product) => this.withReadableImageUrls(product)),
    );
  }

  async create(
    owner: SafeUser,
    dto: CreateProductDto,
  ): Promise<ProductResponse> {
    const slug = await this.createUniqueSlug(dto.title);
    const media = dto.media ?? [];
    const product = await this.productModel.create({
      ownerId: owner.id,
      title: dto.title,
      slug,
      category: dto.category,
      categorySlug: dto.categorySlug,
      description: dto.description,
      pricePerDay: dto.pricePerDay,
      deposit: dto.deposit,
      city: dto.city,
      ownerName: owner.fullName,
      rating: 0,
      isAvailable: true,
      images: media,
    });

    return this.withReadableImageUrls(product);
  }

  async update(
    owner: SafeUser,
    productId: string,
    dto: UpdateProductDto,
  ): Promise<ProductResponse> {
    if (!Types.ObjectId.isValid(productId)) {
      throw new NotFoundException("Produsul nu a fost gasit.");
    }

    const product = await this.productModel.findById(productId).exec();

    if (!product) {
      throw new NotFoundException("Produsul nu a fost gasit.");
    }

    const ownedByUser = product.ownerId
      ? product.ownerId === owner.id
      : product.ownerName === owner.fullName;

    if (!ownedByUser) {
      throw new ForbiddenException("Nu poti edita acest produs.");
    }

    if (dto.title !== undefined && dto.title !== product.title) {
      product.title = dto.title;
      product.slug = await this.createUniqueSlug(dto.title, product._id);
    }

    if (dto.category !== undefined) product.category = dto.category;
    if (dto.categorySlug !== undefined) product.categorySlug = dto.categorySlug;
    if (dto.description !== undefined) product.description = dto.description;
    if (dto.pricePerDay !== undefined) product.pricePerDay = dto.pricePerDay;
    if (dto.deposit !== undefined) product.deposit = dto.deposit;
    if (dto.city !== undefined) product.city = dto.city;
    if (dto.media !== undefined) product.images = dto.media;

    return this.withReadableImageUrls(await product.save());
  }

  async findBySlug(slug: string): Promise<ProductResponse | null> {
    const product = await this.productModel.findOne({ slug }).exec();
    return product ? this.withReadableImageUrls(product) : null;
  }

  async seedMockProducts(): Promise<ProductResponse[]> {
    await this.categoriesService.seedMockCategories();

    const products: ProductResponse[] = [];

    for (const product of mockProducts) {
      const image = await this.s3StorageService.uploadRemoteImage({
        sourceUrl: `https://picsum.photos/seed/${product.imageSeed}/1200/800`,
        key: `products/${product.slug}.jpg`,
        alt: product.title,
      });

      const savedProduct = await this.productModel
        .findOneAndUpdate(
          { slug: product.slug },
          {
            $set: {
              title: product.title,
              slug: product.slug,
              category: product.category,
              categorySlug: product.categorySlug,
              description: product.description,
              pricePerDay: product.pricePerDay,
              deposit: product.deposit,
              city: product.city,
              ownerName: product.ownerName,
              rating: product.rating,
              isAvailable: true,
              images: [image],
            },
          },
          { new: true, upsert: true, setDefaultsOnInsert: true },
        )
        .exec();

      products.push(await this.withReadableImageUrls(savedProduct));
    }

    return products;
  }

  private async withReadableImageUrls(
    product: ProductDocument,
  ): Promise<ProductResponse> {
    const productObject = product.toObject();
    const images = await Promise.all(
      product.images.map(async (image) => ({
        url: await this.s3StorageService.getReadableUrl(image.key),
        key: image.key,
        alt: image.alt,
        contentType: image.contentType,
        type: image.type,
      })),
    );

    return {
      ...productObject,
      images,
    };
  }

  private async createUniqueSlug(
    title: string,
    excludeProductId?: Types.ObjectId,
  ): Promise<string> {
    const baseSlug = this.slugify(title);
    let slug = baseSlug;
    let suffix = 2;

    while (
      await this.productModel.exists({
        slug,
        ...(excludeProductId ? { _id: { $ne: excludeProductId } } : {}),
      })
    ) {
      slug = `${baseSlug}-${suffix}`;
      suffix += 1;
    }

    return slug;
  }

  private slugify(value: string): string {
    return (
      value
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 80) || "produs"
    );
  }
}
