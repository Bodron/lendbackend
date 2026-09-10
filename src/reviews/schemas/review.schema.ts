import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { HydratedDocument, Types } from "mongoose";

export type ReviewDocument = HydratedDocument<Review>;

@Schema({ timestamps: true })
export class Review {
  @Prop({ type: Types.ObjectId, required: true, ref: "Product", index: true })
  productId!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, required: true, ref: "RentalOrder", unique: true })
  rentalOrderId!: Types.ObjectId;

  @Prop({ required: true, index: true })
  reviewerId!: string;

  @Prop({ required: true, min: 1, max: 5 })
  rating!: number;

  @Prop({ required: true, trim: true, maxlength: 1000 })
  comment!: string;
}

export const ReviewSchema = SchemaFactory.createForClass(Review);
ReviewSchema.index({ productId: 1, createdAt: -1 });
