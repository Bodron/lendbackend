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

export enum RentalPaymentStatus {
  RequiresPayment = "requires_payment",
  Authorized = "authorized",
  Captured = "captured",
  Cancelled = "cancelled",
  Refunded = "refunded",
  Processing = "processing",
  Succeeded = "succeeded",
  Failed = "failed",
  Disputed = "disputed",
}

export enum RentalPayoutStatus {
  NotReady = "not_ready",
  PendingOnboarding = "pending_onboarding",
  Ready = "ready",
  PaidOut = "paid_out",
  HeldUntilReturn = "held_until_return",
  Eligible = "eligible",
  Processing = "processing",
  Failed = "failed",
}

export type RentalProductSnapshot = {
  title: string;
  slug: string;
  category: string;
  categorySlug: string;
  city: string;
  ownerName: string;
  imageKey?: string;
  imageUrl?: string;
  imageContentType?: string;
  imageType?: "image" | "video";
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
      imageKey: { type: String },
      imageUrl: { type: String },
      imageContentType: { type: String },
      imageType: { type: String, enum: ["image", "video"] },
    },
    required: true,
  })
  productSnapshot!: RentalProductSnapshot;

  @Prop({ required: true, index: true })
  startDate!: Date;

  @Prop({ required: true, index: true })
  endDate!: Date;

  @Prop({ required: true, trim: true, default: "10:00" })
  pickupTime!: string;

  @Prop({ required: true, trim: true, default: "18:00" })
  returnTime!: string;

  @Prop({ required: true, enum: ["day", "hour", "month"], default: "day" })
  rentalMode!: "day" | "hour" | "month";

  @Prop({ required: true, min: 1, default: 1 })
  rentalHours!: number;

  @Prop({ required: true, min: 1 })
  rentalDays!: number;

  @Prop({ required: true, min: 0 })
  pricePerDay!: number;

  @Prop({ required: true, min: 0 })
  subtotal!: number;

  @Prop({ required: true, min: 0 })
  serviceFee!: number;

  @Prop({ required: true, min: 0, default: 0 })
  platformFee!: number;

  @Prop({ required: true, min: 0, default: 0 })
  ownerEarnings!: number;

  @Prop({ required: true, min: 0 })
  deposit!: number;

  @Prop({ required: true, min: 0 })
  total!: number;

  @Prop({ trim: true })
  stripePaymentIntentId?: string;

  @Prop({ trim: true })
  stripePaymentClientSecret?: string;

  @Prop({ trim: true })
  stripeTransferId?: string;

  @Prop({ required: true, min: 0, default: 0 })
  sellerGrossAmount!: number;

  @Prop({ required: true, min: 0, default: 0 })
  sellerNetAmount!: number;

  @Prop()
  payoutEligibleAt?: Date;

  @Prop({ trim: true })
  payoutFailureReason?: string;

  @Prop({ trim: true, default: "none" })
  refundStatus!: string;

  @Prop({ trim: true, default: "none" })
  disputeStatus!: string;

  @Prop({ trim: true })
  contractPdfKey?: string;

  @Prop({ trim: true })
  contractPdfUrl?: string;

  @Prop({ trim: true })
  contractPdfContentType?: string;

  @Prop()
  contractSignedAt?: Date;

  @Prop({
    required: true,
    enum: Object.values(RentalPaymentStatus),
    default: RentalPaymentStatus.RequiresPayment,
    index: true,
  })
  paymentStatus!: RentalPaymentStatus;

  @Prop({
    required: true,
    enum: Object.values(RentalPayoutStatus),
    default: RentalPayoutStatus.NotReady,
    index: true,
  })
  payoutStatus!: RentalPayoutStatus;

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
