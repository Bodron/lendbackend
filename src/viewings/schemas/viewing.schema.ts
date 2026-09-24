import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { HydratedDocument, Types } from "mongoose";

export type ViewingDocument = HydratedDocument<Viewing>;

@Schema({ timestamps: true })
export class Viewing {
  @Prop({ required: true, type: Types.ObjectId, ref: "Product", index: true })
  productId!: Types.ObjectId;

  @Prop({ required: true })
  productTitle!: string;

  @Prop({ required: true, index: true })
  ownerId!: string;

  @Prop({ required: true, index: true })
  visitorId!: string;

  @Prop({ required: true })
  visitorName!: string;

  @Prop({ required: true })
  startsAt!: Date;

  @Prop({ unique: true, sparse: true })
  reservedSlot?: string;

  @Prop({
    required: true,
    enum: [
      "requested",
      "awaiting_payment",
      "confirmed",
      "rejected",
      "cancelled",
      "completed",
    ],
  })
  status!:
    | "requested"
    | "awaiting_payment"
    | "confirmed"
    | "rejected"
    | "cancelled"
    | "completed";

  @Prop({ required: true, min: 0 })
  priceRon!: number;

  @Prop()
  stripePaymentIntentId?: string;

  @Prop()
  paidAt?: Date;

  @Prop()
  stripeRefundId?: string;

  @Prop()
  refundStatus?: string;
}

export const ViewingSchema = SchemaFactory.createForClass(Viewing);
ViewingSchema.index({ productId: 1, startsAt: 1, status: 1 });
