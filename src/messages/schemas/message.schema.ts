import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { HydratedDocument, Types } from "mongoose";

export type MessageDocument = HydratedDocument<Message>;

@Schema({ timestamps: true })
export class Message {
  @Prop({ type: Types.ObjectId, required: true, ref: "Product", index: true })
  productId!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: "RoommateInterest", index: true })
  roommateInterestId?: Types.ObjectId;

  @Prop({ required: true, index: true })
  senderId!: string;

  @Prop({ required: true, index: true })
  recipientId!: string;

  @Prop({ required: true, trim: true, maxlength: 2000 })
  body!: string;

  @Prop({ default: false })
  read!: boolean;
}

export const MessageSchema = SchemaFactory.createForClass(Message);
MessageSchema.index({ productId: 1, createdAt: 1 });
MessageSchema.index({ productId: 1, roommateInterestId: 1, createdAt: 1 });
