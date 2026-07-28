import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { HydratedDocument } from "mongoose";

export type ProductDocument = HydratedDocument<Product>;

export type ProductImage = {
  url: string;
  key: string;
  alt: string;
  contentType: string;
};

export type ProductMedia = ProductImage & {
  type: "image" | "video";
};

@Schema({ timestamps: true })
export class Product {
  @Prop({ trim: true, index: true })
  ownerId?: string;

  @Prop({ required: true, trim: true })
  title!: string;

  @Prop({ required: true, trim: true, unique: true, index: true })
  slug!: string;

  @Prop({ required: true, trim: true })
  category!: string;

  @Prop({ required: true, trim: true, index: true })
  categorySlug!: string;

  @Prop({ required: true, trim: true })
  description!: string;

  @Prop({ required: true, min: 0 })
  pricePerDay!: number;

  @Prop({ required: true, min: 0 })
  deposit!: number;

  @Prop({ required: true, trim: true })
  city!: string;

  @Prop({ required: true, trim: true })
  ownerName!: string;

  @Prop({ required: true, min: 0, max: 5 })
  rating!: number;

  @Prop({ required: true, default: true })
  isAvailable!: boolean;

  @Prop({
    type: [
      {
        url: { type: String, required: true },
        key: { type: String, required: true },
        alt: { type: String, required: true },
        contentType: { type: String, required: true },
        type: { type: String, enum: ["image", "video"], default: "image" },
      },
    ],
    default: [],
  })
  images!: ProductMedia[];
}

export const ProductSchema = SchemaFactory.createForClass(Product);
