import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { HydratedDocument, Types } from "mongoose";

export type AvailabilityBlockDocument = HydratedDocument<AvailabilityBlock>;

@Schema({ timestamps: true })
export class AvailabilityBlock {
  @Prop({ type: Types.ObjectId, required: true, ref: "Product", index: true })
  productId!: Types.ObjectId;

  @Prop({ required: true, index: true })
  ownerId!: string;

  @Prop({ required: true, index: true })
  startDate!: Date;

  @Prop({ required: true, index: true })
  endDate!: Date;

  @Prop({ trim: true })
  reason?: string;
}

export const AvailabilityBlockSchema =
  SchemaFactory.createForClass(AvailabilityBlock);

AvailabilityBlockSchema.index({ productId: 1, startDate: 1, endDate: 1 });
