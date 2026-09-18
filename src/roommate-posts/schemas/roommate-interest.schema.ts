import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { HydratedDocument, Types } from "mongoose";

export type RoommateInterestDocument = HydratedDocument<RoommateInterest>;

export enum RoommateInterestStatus {
  Pending = "pending",
  Accepted = "accepted",
  Rejected = "rejected",
}

@Schema({ timestamps: true })
export class RoommateInterest {
  @Prop({
    type: Types.ObjectId,
    required: true,
    ref: "RoommatePost",
    index: true,
  })
  postId!: Types.ObjectId;

  @Prop({ required: true, trim: true, index: true })
  senderId!: string;

  @Prop({ required: true, trim: true })
  senderName!: string;

  @Prop({ trim: true })
  senderAvatarUrl?: string;

  @Prop({ required: true, trim: true, index: true })
  recipientId!: string;

  @Prop({ trim: true, default: "" })
  message!: string;

  @Prop({
    required: true,
    enum: Object.values(RoommateInterestStatus),
    default: RoommateInterestStatus.Pending,
    index: true,
  })
  status!: RoommateInterestStatus;
}

export const RoommateInterestSchema =
  SchemaFactory.createForClass(RoommateInterest);
RoommateInterestSchema.index({ postId: 1, senderId: 1 }, { unique: true });
