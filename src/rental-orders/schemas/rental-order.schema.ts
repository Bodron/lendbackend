import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { HydratedDocument, Types } from "mongoose";

export type RentalOrderDocument = HydratedDocument<RentalOrder>;

export enum RentalOrderStatus {
  Pending = "pending",
  Confirmed = "confirmed",
  Active = "active",
  Completed = "completed",
  Cancelled = "cancelled",
  Rejected = "rejected",
}

export type RentalProductSnapshot = {
  title: string;
  slug: string;
  category: string;
  categorySlug: string;
  city: string;
  ownerName: string;
  imageUrl?: string;
};

@Schema({ timestamps: true })
export class RentalOrder {
  @Prop({ type: Types.ObjectId, required: true, ref: "Product", index: true })
  productId!: Types.ObjectId;

  @Prop({ required: true, index: true })
  renterId!: string;

  @Prop({
    type: {
      title: { type: String, required: true },
      slug: { type: String, required: true },
      category: { type: String, required: true },
      categorySlug: { type: String, required: true },
      city: { type: String, required: true },
      ownerName: { type: String, required: true },
      imageUrl: { type: String },
    },
    required: true,
  })
  productSnapshot!: RentalProductSnapshot;

  @Prop({ required: true, index: true })
  startDate!: Date;

  @Prop({ required: true, index: true })
  endDate!: Date;

  @Prop({ required: true, min: 1 })
  rentalDays!: number;

  @Prop({ required: true, min: 0 })
  pricePerDay!: number;

  @Prop({ required: true, min: 0 })
  subtotal!: number;

  @Prop({ required: true, min: 0 })
  serviceFee!: number;

  @Prop({ required: true, min: 0 })
  deposit!: number;

  @Prop({ required: true, min: 0 })
  total!: number;

  @Prop({
    required: true,
    enum: Object.values(RentalOrderStatus),
    default: RentalOrderStatus.Pending,
    index: true,
  })
  status!: RentalOrderStatus;
}

export const RentalOrderSchema = SchemaFactory.createForClass(RentalOrder);

RentalOrderSchema.index({ productId: 1, startDate: 1, endDate: 1, status: 1 });
RentalOrderSchema.index({ renterId: 1, createdAt: -1 });
