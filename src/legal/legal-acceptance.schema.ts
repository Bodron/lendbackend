import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { HydratedDocument } from "mongoose";

export type LegalAcceptanceDocument = HydratedDocument<LegalAcceptance>;

@Schema({ timestamps: false })
export class LegalAcceptance {
  @Prop({ required: true, index: true })
  userId!: string;

  @Prop({ required: true })
  documentId!: string;

  @Prop({ required: true })
  version!: string;

  @Prop({ required: true })
  hash!: string;

  @Prop({ required: true })
  acceptedAt!: Date;
}

export const LegalAcceptanceSchema =
  SchemaFactory.createForClass(LegalAcceptance);
LegalAcceptanceSchema.index(
  { userId: 1, documentId: 1, version: 1, hash: 1 },
  { unique: true },
);
