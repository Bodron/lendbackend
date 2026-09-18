import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { HydratedDocument, Types } from "mongoose";

export type RoommatePostDocument = HydratedDocument<RoommatePost>;

export enum RoommatePostStatus {
  Open = "open",
  Closed = "closed",
}

@Schema({ timestamps: true })
export class RoommatePost {
  @Prop({ type: Types.ObjectId, ref: "Product", index: true })
  productId?: Types.ObjectId;

  @Prop({ required: true, trim: true, index: true })
  authorId!: string;

  @Prop({ required: true, trim: true })
  authorName!: string;

  @Prop({ trim: true })
  authorAvatarUrl?: string;

  @Prop({ required: true, trim: true })
  title!: string;

  @Prop({ required: true, trim: true, index: true })
  city!: string;

  @Prop({ trim: true, default: "" })
  area!: string;

  @Prop({ required: true, min: 1 })
  budgetPerMonth!: number;

  @Prop({ trim: true, default: "" })
  moveInDate!: string;

  @Prop({ required: true, trim: true })
  description!: string;

  @Prop({ type: [String], default: [] })
  preferences!: string[];

  @Prop({
    required: true,
    enum: Object.values(RoommatePostStatus),
    default: RoommatePostStatus.Open,
    index: true,
  })
  status!: RoommatePostStatus;
}

export const RoommatePostSchema = SchemaFactory.createForClass(RoommatePost);
