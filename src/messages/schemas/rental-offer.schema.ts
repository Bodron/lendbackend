import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { HydratedDocument } from "mongoose";

export type RentalOfferDocument = HydratedDocument<RentalOffer>;

@Schema({ timestamps: true })
export class RentalOffer {
  @Prop({ required: true, index: true }) productId!: string;
  @Prop({ required: true, index: true }) senderId!: string;
  @Prop({ required: true }) recipientId!: string;
  @Prop({ required: true, min: 1 }) amount!: number;
  @Prop({ required: true }) startDate!: Date;
  @Prop({ required: true }) endDate!: Date;
  @Prop({ required: true, enum: ["day", "hour", "month"] })
  rentalMode!: "day" | "hour" | "month";
  @Prop({ required: true, enum: ["pending", "accepted", "rejected", "expired"], default: "pending" })
  status!: "pending" | "accepted" | "rejected" | "expired";
}

export const RentalOfferSchema = SchemaFactory.createForClass(RentalOffer);
