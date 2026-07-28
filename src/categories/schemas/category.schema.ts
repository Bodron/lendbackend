import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { HydratedDocument } from "mongoose";

export type CategoryDocument = HydratedDocument<Category>;

@Schema({ timestamps: true })
export class Category {
  @Prop({ required: true, trim: true })
  name!: string;

  @Prop({ required: true, trim: true, unique: true, index: true })
  slug!: string;

  @Prop({ required: true, trim: true })
  description!: string;

  @Prop({ required: true, trim: true })
  iconName!: string;

  @Prop({ required: true, min: 0, index: true })
  sortOrder!: number;

  @Prop({ required: true, default: true, index: true })
  isActive!: boolean;
}

export const CategorySchema = SchemaFactory.createForClass(Category);
